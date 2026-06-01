package controllers

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/backend/config"
	"github.com/backend/models"
	"github.com/backend/utils"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var orgCollection *mongo.Collection = config.GetCollection(config.DB, "organizations")
var orgMemberCollection *mongo.Collection = config.GetCollection(config.DB, "org_members")
var invitationCollection *mongo.Collection = config.GetCollection(config.DB, "invitations")
var usersCollection *mongo.Collection = config.GetCollection(config.DB, "users")

// getMemberRole returns the role of a user in an org, and whether they are a member
func getMemberRole(ctx context.Context, orgID primitive.ObjectID, userID string) (string, bool) {
	var member models.OrgMember
	err := orgMemberCollection.FindOne(ctx, bson.M{
		"orgId":  orgID,
		"userId": userID,
		"status": "active",
	}).Decode(&member)
	if err != nil {
		return "", false
	}
	return member.Role, true
}

func isAdminOrOwner(role string) bool {
	return role == "owner" || role == "admin"
}

// POST /api/organizations
func CreateOrganization() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		userID, _ := c.Get("userId")
		userIDStr := userID.(string)

		// Each user may only belong to one organization.
		existingCount, _ := orgMemberCollection.CountDocuments(ctx, bson.M{
			"userId": userIDStr,
			"status": "active",
		})
		if existingCount > 0 {
			c.JSON(http.StatusForbidden, gin.H{
				"status":  http.StatusForbidden,
				"message": "You are already part of an organization. Each user can only belong to one organization.",
				"error":   "forbidden",
			})
			return
		}

		var input struct {
			Name        string `json:"name" binding:"required"`
			Description string `json:"description"`
		}
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "error", "error": err.Error()})
			return
		}

		org := models.Organization{
			ID:          primitive.NewObjectID(),
			Name:        input.Name,
			Description: input.Description,
			CreatedBy:   userIDStr,
			CreatedAt:   time.Now(),
			UpdatedAt:   time.Now(),
		}

		_, err := orgCollection.InsertOne(ctx, org)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to create organization"})
			return
		}

		// Creator becomes owner
		member := models.OrgMember{
			ID:        primitive.NewObjectID(),
			OrgID:     org.ID,
			UserID:    userIDStr,
			Role:      "owner",
			Status:    "active",
			JoinedAt:  time.Now(),
			CreatedAt: time.Now(),
		}
		_, err = orgMemberCollection.InsertOne(ctx, member)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to add owner member"})
			return
		}

		// Stamp the user's primary orgId so signin can return it
		usersCollection.UpdateOne(ctx,
			bson.M{"userId": userIDStr},
			bson.M{"$set": bson.M{"orgId": org.ID}},
		)

		// Auto-seed default chart of accounts for the new org
		go func() {
			seedCtx, seedCancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer seedCancel()
			seedDefaultAccountsForOrg(seedCtx, org.ID.Hex(), userIDStr)
		}()

		c.JSON(http.StatusCreated, gin.H{
			"status":  http.StatusCreated,
			"message": "Organization created successfully",
			"data":    org,
		})
	}
}

// GET /api/organizations — returns all orgs the authenticated user belongs to
func GetUserOrganizations() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		userID, _ := c.Get("userId")
		userIDStr := userID.(string)

		cursor, err := orgMemberCollection.Find(ctx, bson.M{
			"userId": userIDStr,
			"status": "active",
		})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "error", "error": err.Error()})
			return
		}
		defer cursor.Close(ctx)

		var members []models.OrgMember
		cursor.All(ctx, &members)

		if len(members) == 0 {
			c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "data": []interface{}{}})
			return
		}

		orgIDs := make([]primitive.ObjectID, 0, len(members))
		roleMap := make(map[primitive.ObjectID]string)
		for _, m := range members {
			orgIDs = append(orgIDs, m.OrgID)
			roleMap[m.OrgID] = m.Role
		}

		orgCursor, err := orgCollection.Find(ctx, bson.M{"_id": bson.M{"$in": orgIDs}})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "error", "error": err.Error()})
			return
		}
		defer orgCursor.Close(ctx)

		var orgs []models.Organization
		orgCursor.All(ctx, &orgs)

		type OrgWithRole struct {
			models.Organization
			Role string `json:"role"`
		}
		result := make([]OrgWithRole, 0, len(orgs))
		for _, org := range orgs {
			result = append(result, OrgWithRole{org, roleMap[org.ID]})
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "data": result})
	}
}

// GET /api/organizations/:id
func GetOrganization() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		userID, _ := c.Get("userId")
		orgID, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid org ID"})
			return
		}

		role, isMember := getMemberRole(ctx, orgID, userID.(string))
		if !isMember {
			c.JSON(http.StatusForbidden, gin.H{"status": http.StatusForbidden, "message": "Access denied"})
			return
		}

		var org models.Organization
		if err = orgCollection.FindOne(ctx, bson.M{"_id": orgID}).Decode(&org); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Organization not found"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "data": gin.H{
			"_id":                 org.ID,
			"name":                org.Name,
			"description":         org.Description,
			"letterheadImage":     org.LetterheadImage,
			"letterheadTopPad":    org.LetterheadTopPad,
			"letterheadBottomPad": org.LetterheadBottomPad,
			"createdBy":           org.CreatedBy,
			"createdAt":           org.CreatedAt,
			"role":                role,
		}})
	}
}

// PUT /api/organizations/:id
func UpdateOrganization() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		userID, _ := c.Get("userId")
		orgID, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid org ID"})
			return
		}

		role, isMember := getMemberRole(ctx, orgID, userID.(string))
		if !isMember || !isAdminOrOwner(role) {
			c.JSON(http.StatusForbidden, gin.H{"status": http.StatusForbidden, "message": "Only admins and owners can update the organization"})
			return
		}

		var input struct {
			Name        string `json:"name"`
			Description string `json:"description"`
		}
		c.ShouldBindJSON(&input)

		_, err = orgCollection.UpdateOne(ctx, bson.M{"_id": orgID}, bson.M{"$set": bson.M{
			"name":        input.Name,
			"description": input.Description,
			"updatedAt":   time.Now(),
		}})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to update organization"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Organization updated"})
	}
}

// DELETE /api/organizations/:id — owner only
func DeleteOrganization() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		userID, _ := c.Get("userId")
		orgID, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid org ID"})
			return
		}

		role, isMember := getMemberRole(ctx, orgID, userID.(string))
		if !isMember || role != "owner" {
			c.JSON(http.StatusForbidden, gin.H{"status": http.StatusForbidden, "message": "Only the owner can delete an organization"})
			return
		}

		orgCollection.DeleteOne(ctx, bson.M{"_id": orgID})
		orgMemberCollection.DeleteMany(ctx, bson.M{"orgId": orgID})
		invitationCollection.DeleteMany(ctx, bson.M{"orgId": orgID})

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Organization deleted"})
	}
}

// GET /api/organizations/:id/members
func GetOrgMembers() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		userID, _ := c.Get("userId")
		orgID, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid org ID"})
			return
		}

		_, isMember := getMemberRole(ctx, orgID, userID.(string))
		if !isMember {
			c.JSON(http.StatusForbidden, gin.H{"status": http.StatusForbidden, "message": "Access denied"})
			return
		}

		cursor, err := orgMemberCollection.Find(ctx, bson.M{"orgId": orgID, "status": "active"})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "error"})
			return
		}
		defer cursor.Close(ctx)

		var members []models.OrgMember
		cursor.All(ctx, &members)

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "data": members})
	}
}

// POST /api/organizations/:id/invite
func InviteMember() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		userID, _ := c.Get("userId")
		orgID, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid org ID"})
			return
		}

		role, isMember := getMemberRole(ctx, orgID, userID.(string))
		if !isMember || !isAdminOrOwner(role) {
			c.JSON(http.StatusForbidden, gin.H{"status": http.StatusForbidden, "message": "Only admins and owners can invite members"})
			return
		}

		var input struct {
			Email string `json:"email" binding:"required"`
			Role  string `json:"role" binding:"required"`
		}
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "error", "error": err.Error()})
			return
		}

		validRoles := map[string]bool{"admin": true, "member": true, "viewer": true}
		if !validRoles[input.Role] {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid role. Must be admin, member, or viewer"})
			return
		}

		// Already a pending invite for this email in this org?
		pendingCount, _ := invitationCollection.CountDocuments(ctx, bson.M{
			"orgId": orgID, "email": input.Email, "status": "pending",
		})
		if pendingCount > 0 {
			c.JSON(http.StatusConflict, gin.H{"status": http.StatusConflict, "message": "An invitation has already been sent to this email"})
			return
		}

		var org models.Organization
		orgCollection.FindOne(ctx, bson.M{"_id": orgID}).Decode(&org)

		// Generate unique token
		tokenBytes := make([]byte, 16)
		rand.Read(tokenBytes)
		token := hex.EncodeToString(tokenBytes)

		invitation := models.Invitation{
			ID:        primitive.NewObjectID(),
			OrgID:     orgID,
			OrgName:   org.Name,
			Email:     input.Email,
			Role:      input.Role,
			Token:     token,
			InvitedBy: userID.(string),
			ExpiresAt: time.Now().Add(7 * 24 * time.Hour),
			Status:    "pending",
			CreatedAt: time.Now(),
		}

		_, err = invitationCollection.InsertOne(ctx, invitation)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to create invitation"})
			return
		}

		// Send invite email asynchronously
		go func() {
			if emailErr := utils.SendInvitationEmail(
				input.Email, "", org.Name, userID.(string), input.Role, token,
			); emailErr != nil {
				log.Printf("invite email to %s failed: %v", input.Email, emailErr)
			}
		}()

		c.JSON(http.StatusCreated, gin.H{
			"status":  http.StatusCreated,
			"message": "Invitation sent to " + input.Email,
			"data": gin.H{
				"token": token,
				"email": input.Email,
				"role":  input.Role,
			},
		})
	}
}

// PUT /api/organizations/:id/members/:userId/role
func UpdateMemberRole() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		userID, _ := c.Get("userId")
		orgID, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid org ID"})
			return
		}
		targetUserID := c.Param("userId")

		role, isMember := getMemberRole(ctx, orgID, userID.(string))
		if !isMember || !isAdminOrOwner(role) {
			c.JSON(http.StatusForbidden, gin.H{"status": http.StatusForbidden, "message": "Only admins and owners can change roles"})
			return
		}

		var input struct {
			Role string `json:"role" binding:"required"`
		}
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "error", "error": err.Error()})
			return
		}

		validRoles := map[string]bool{"admin": true, "member": true, "viewer": true}
		if !validRoles[input.Role] {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid role. Must be admin, member, or viewer"})
			return
		}

		targetRole, targetExists := getMemberRole(ctx, orgID, targetUserID)
		if !targetExists {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Member not found"})
			return
		}
		if targetRole == "owner" {
			c.JSON(http.StatusForbidden, gin.H{"status": http.StatusForbidden, "message": "Cannot change the owner's role"})
			return
		}

		_, err = orgMemberCollection.UpdateOne(ctx,
			bson.M{"orgId": orgID, "userId": targetUserID},
			bson.M{"$set": bson.M{"role": input.Role}},
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to update role"})
			return
		}

		var roleOrg models.Organization
		orgCollection.FindOne(ctx, bson.M{"_id": orgID}).Decode(&roleOrg)
		go pushNotification(
			targetUserID, "role_changed",
			"Your role was updated",
			"Your role in "+roleOrg.Name+" was changed to "+input.Role+" by "+userID.(string),
			orgID.Hex(), roleOrg.Name,
		)

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Role updated"})
	}
}

// DELETE /api/organizations/:id/members/:userId
func RemoveMember() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		userID, _ := c.Get("userId")
		orgID, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid org ID"})
			return
		}
		targetUserID := c.Param("userId")

		callerRole, isMember := getMemberRole(ctx, orgID, userID.(string))
		isSelf := userID.(string) == targetUserID
		if !isMember || (!isAdminOrOwner(callerRole) && !isSelf) {
			c.JSON(http.StatusForbidden, gin.H{"status": http.StatusForbidden, "message": "Only admins and owners can remove members"})
			return
		}

		targetRole, targetExists := getMemberRole(ctx, orgID, targetUserID)
		if !targetExists {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Member not found"})
			return
		}
		if targetRole == "owner" {
			c.JSON(http.StatusForbidden, gin.H{"status": http.StatusForbidden, "message": "Cannot remove the organization owner"})
			return
		}

		_, err = orgMemberCollection.DeleteOne(ctx, bson.M{"orgId": orgID, "userId": targetUserID})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to remove member"})
			return
		}

		var removeOrg models.Organization
		orgCollection.FindOne(ctx, bson.M{"_id": orgID}).Decode(&removeOrg)
		go pushNotification(
			targetUserID, "removed",
			"Removed from organization",
			"You were removed from "+removeOrg.Name+" by "+userID.(string),
			orgID.Hex(), removeOrg.Name,
		)

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Member removed"})
	}
}

// POST /api/invitations/accept
func AcceptInvitation() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		userID, _ := c.Get("userId")

		var input struct {
			Token string `json:"token" binding:"required"`
		}
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "error", "error": err.Error()})
			return
		}

		var invitation models.Invitation
		err := invitationCollection.FindOne(ctx, bson.M{
			"token":  input.Token,
			"status": "pending",
		}).Decode(&invitation)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Invitation not found or already used"})
			return
		}

		if time.Now().After(invitation.ExpiresAt) {
			invitationCollection.UpdateOne(ctx, bson.M{"_id": invitation.ID}, bson.M{"$set": bson.M{"status": "expired"}})
			c.JSON(http.StatusGone, gin.H{"status": http.StatusGone, "message": "Invitation has expired"})
			return
		}

		// Check if logged-in user is already a member of this org
		alreadyMember, _ := orgMemberCollection.CountDocuments(ctx, bson.M{
			"orgId":  invitation.OrgID,
			"userId": userID.(string),
			"status": "active",
		})
		if alreadyMember > 0 {
			c.JSON(http.StatusConflict, gin.H{"status": http.StatusConflict, "message": "You are already a member of this organization"})
			return
		}

		member := models.OrgMember{
			ID:        primitive.NewObjectID(),
			OrgID:     invitation.OrgID,
			UserID:    userID.(string),
			Role:      invitation.Role,
			Status:    "active",
			InvitedBy: invitation.InvitedBy,
			JoinedAt:  time.Now(),
			CreatedAt: time.Now(),
		}
		orgMemberCollection.InsertOne(ctx, member)
		// Record which user accepted and mark as accepted
		invitationCollection.UpdateOne(ctx, bson.M{"_id": invitation.ID}, bson.M{"$set": bson.M{
			"status": "accepted",
			"userId": userID.(string),
		}})
		// Stamp the user's primary orgId so signin can return it
		usersCollection.UpdateOne(ctx,
			bson.M{"userId": userID.(string)},
			bson.M{"$set": bson.M{"orgId": invitation.OrgID}},
		)

		// Notify inviter that their invitation was accepted
		go pushNotification(
			invitation.InvitedBy, "accepted",
			"Invitation accepted",
			userID.(string)+" accepted your invitation and joined "+invitation.OrgName,
			invitation.OrgID.Hex(), invitation.OrgName,
		)

		c.JSON(http.StatusOK, gin.H{
			"status":  http.StatusOK,
			"message": "Invitation accepted",
			"data": gin.H{
				"orgId":   invitation.OrgID,
				"orgName": invitation.OrgName,
				"role":    invitation.Role,
			},
		})
	}
}

// GET /api/invitations/:token — public, for showing invite details before accepting
func GetInvitationByToken() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		token := c.Param("token")
		var invitation models.Invitation
		err := invitationCollection.FindOne(ctx, bson.M{"token": token}).Decode(&invitation)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"status": http.StatusNotFound, "message": "Invitation not found"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"status": http.StatusOK,
			"data": gin.H{
				"orgName":   invitation.OrgName,
				"email":     invitation.Email,
				"role":      invitation.Role,
				"status":    invitation.Status,
				"expiresAt": invitation.ExpiresAt,
				"invitedBy": invitation.InvitedBy,
			},
		})
	}
}

// GET /api/organizations/:id/invitations — pending invites for an org (admin/owner only)
func GetOrgInvitations() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		userID, _ := c.Get("userId")
		orgID, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid org ID"})
			return
		}

		role, isMember := getMemberRole(ctx, orgID, userID.(string))
		if !isMember || !isAdminOrOwner(role) {
			c.JSON(http.StatusForbidden, gin.H{"status": http.StatusForbidden, "message": "Access denied"})
			return
		}

		cursor, err := invitationCollection.Find(ctx, bson.M{"orgId": orgID, "status": "pending"})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "error"})
			return
		}
		defer cursor.Close(ctx)

		var invitations []models.Invitation
		cursor.All(ctx, &invitations)

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "data": invitations})
	}
}

// GET /api/users/invitations — current user's pending invitations
func GetUserInvitations() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		userID, _ := c.Get("userId")

		cursor, err := invitationCollection.Find(ctx, bson.M{
			"userId": userID.(string),
			"status": "pending",
		})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "error"})
			return
		}
		defer cursor.Close(ctx)

		var invitations []models.Invitation
		cursor.All(ctx, &invitations)

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "data": invitations})
	}
}

// DELETE /api/organizations/:id/invitations/:invitationId — cancel a pending invite
func CancelInvitation() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		userID, _ := c.Get("userId")
		orgID, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid org ID"})
			return
		}

		role, isMember := getMemberRole(ctx, orgID, userID.(string))
		if !isMember || !isAdminOrOwner(role) {
			c.JSON(http.StatusForbidden, gin.H{"status": http.StatusForbidden, "message": "Access denied"})
			return
		}

		invitationID, err := primitive.ObjectIDFromHex(c.Param("invitationId"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid invitation ID"})
			return
		}

		invitationCollection.DeleteOne(ctx, bson.M{"_id": invitationID, "orgId": orgID})
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Invitation cancelled"})
	}
}

// PATCH /api/organizations/:id/letterhead
func UpdateLetterhead() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		userID, _ := c.Get("userId")
		orgID, err := primitive.ObjectIDFromHex(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid org ID"})
			return
		}

		role, isMember := getMemberRole(ctx, orgID, userID.(string))
		if !isMember || !isAdminOrOwner(role) {
			c.JSON(http.StatusForbidden, gin.H{"status": http.StatusForbidden, "message": "Only admins and owners can update the letterhead"})
			return
		}

		var input struct {
			LetterheadImage     string `json:"letterheadImage"`
			LetterheadTopPad    int    `json:"letterheadTopPad"`
			LetterheadBottomPad int    `json:"letterheadBottomPad"`
		}
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": http.StatusBadRequest, "message": "Invalid request body"})
			return
		}

		_, err = orgCollection.UpdateOne(ctx, bson.M{"_id": orgID}, bson.M{"$set": bson.M{
			"letterheadImage":     input.LetterheadImage,
			"letterheadTopPad":    input.LetterheadTopPad,
			"letterheadBottomPad": input.LetterheadBottomPad,
			"updatedAt":           time.Now(),
		}})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": http.StatusInternalServerError, "message": "Failed to update letterhead"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Letterhead updated"})
	}
}

// ── Org Settings (salutations and other org-level config) ──────────────────

var orgSettingsCollection *mongo.Collection = config.GetCollection(config.DB, "org_settings")

// GetOrgSettings returns the settings for the current org.
func GetOrgSettings() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgIDStr, _ := c.Get("orgId")
		var settings bson.M
		err := orgSettingsCollection.FindOne(ctx, bson.M{"orgId": fmt.Sprintf("%v", orgIDStr)}).Decode(&settings)
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"status": http.StatusOK,
				"data":   gin.H{"salutations": []string{"Mr.", "Mrs.", "Ms.", "Miss", "Dr."}},
			})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "data": settings})
	}
}

// UpdateOrgSettings saves org-level configuration (salutations list, etc.).
func UpdateOrgSettings() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		orgIDStr := fmt.Sprintf("%v", func() interface{} { v, _ := c.Get("orgId"); return v }())

		var body bson.M
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		body["orgId"] = orgIDStr
		body["updatedAt"] = time.Now()

		opts := options.Update().SetUpsert(true)
		orgSettingsCollection.UpdateOne(ctx,
			bson.M{"orgId": orgIDStr},
			bson.M{"$set": body},
			opts,
		)
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Settings updated"})
	}
}
