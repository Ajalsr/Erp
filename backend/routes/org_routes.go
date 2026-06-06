package routes

import (
	"github.com/backend/controllers"
	"github.com/backend/middlewares"
	"github.com/gin-gonic/gin"
)

func OrgRoutes(router *gin.Engine) {
	// Organization CRUD
	orgRoutes := router.Group("/api/organizations")
	orgRoutes.Use(middlewares.Authenticate)
	{
		orgRoutes.POST("", controllers.CreateOrganization())
		orgRoutes.GET("", controllers.GetUserOrganizations())
		orgRoutes.GET("/:id", controllers.GetOrganization())
		orgRoutes.PUT("/:id", controllers.UpdateOrganization())
		orgRoutes.DELETE("/:id", controllers.DeleteOrganization())
		orgRoutes.PATCH("/:id/letterhead", controllers.UpdateLetterhead())
		orgRoutes.PATCH("/:id/stamp", controllers.UpdateStamp())
		orgRoutes.PATCH("/:id/role-permissions", controllers.UpdateRolePermissions())
		orgRoutes.PATCH("/:id/roles", controllers.UpdateCustomRoles())
		orgRoutes.PATCH("/:id/stamp", controllers.UpdateStamp())

		// Members
		orgRoutes.GET("/:id/members", controllers.GetOrgMembers())
		orgRoutes.POST("/:id/invite", controllers.InviteMember())
		orgRoutes.PUT("/:id/members/:userId/role", controllers.UpdateMemberRole())
		orgRoutes.DELETE("/:id/members/:userId", controllers.RemoveMember())

		// Pending invitations for an org
		orgRoutes.GET("/:id/invitations", controllers.GetOrgInvitations())
		orgRoutes.DELETE("/:id/invitations/:invitationId", controllers.CancelInvitation())
	}

	// Invitation routes
	invRoutes := router.Group("/api/invitations")
	{
		// Public: view invite details by token (no auth needed so invitee can see before logging in)
		invRoutes.GET("/:token", controllers.GetInvitationByToken())

		// Protected: accept invite and view user's own invites
		invRoutes.POST("/accept", middlewares.Authenticate, controllers.AcceptInvitation())
	}

	// Current user's invitations
	userRoutes := router.Group("/api/users")
	userRoutes.Use(middlewares.Authenticate)
	{
		userRoutes.GET("/invitations", controllers.GetUserInvitations())
	}

	// Org settings (salutations, etc.) — requires org context
	orgSettingsRoutes := router.Group("/api/org")
	orgSettingsRoutes.Use(middlewares.Authenticate, middlewares.RequireOrg)
	{
		orgSettingsRoutes.GET("/settings", controllers.GetOrgSettings())
		orgSettingsRoutes.PUT("/settings", controllers.UpdateOrgSettings())
	}
}
