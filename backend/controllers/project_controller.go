package controllers

import (
	"context"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/backend/config"
	"github.com/backend/models"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var projectCollection = config.GetCollection(config.DB, "projects")

type projectRequest struct {
	ProjectNo      string           `json:"projectNo"`
	ProjectName    string           `json:"projectName"`
	Emirates       string           `json:"emirates"`
	Location       string           `json:"location"`
	TypeOfProject  string           `json:"typeOfProject"`
	ItemsProposed  string           `json:"itemsProposed"`
	MainContractor string           `json:"mainContractor"`
	SubContractors []models.Contact `json:"subContractors"`
	Consultants    []models.Contact `json:"consultants"`
	Client         models.Contact   `json:"client"`
}

func (r projectRequest) validate() error {
	if strings.TrimSpace(r.ProjectName) == "" {
		return fmt.Errorf("project name is required")
	}
	return nil
}

// trimContacts drops fully-empty rows (the UI keeps a blank trailing row) and
// trims whitespace so the stored list is clean.
func trimContacts(in []models.Contact) []models.Contact {
	out := make([]models.Contact, 0, len(in))
	for _, ct := range in {
		ct = models.Contact{
			Name:          strings.TrimSpace(ct.Name),
			Role:          strings.TrimSpace(ct.Role),
			ContactPerson: strings.TrimSpace(ct.ContactPerson),
			Position:      strings.TrimSpace(ct.Position),
			ContactNumber: strings.TrimSpace(ct.ContactNumber),
		}
		if ct.Name == "" && ct.Role == "" && ct.ContactPerson == "" && ct.Position == "" && ct.ContactNumber == "" {
			continue
		}
		out = append(out, ct)
	}
	return out
}

func (r projectRequest) toModel() models.Project {
	return models.Project{
		ProjectNo:      strings.TrimSpace(r.ProjectNo),
		ProjectName:    strings.TrimSpace(r.ProjectName),
		Emirates:       strings.TrimSpace(r.Emirates),
		Location:       strings.TrimSpace(r.Location),
		TypeOfProject:  strings.TrimSpace(r.TypeOfProject),
		ItemsProposed:  strings.TrimSpace(r.ItemsProposed),
		MainContractor: strings.TrimSpace(r.MainContractor),
		SubContractors: trimContacts(r.SubContractors),
		Consultants:    trimContacts(r.Consultants),
		Client: models.Contact{
			Name:          strings.TrimSpace(r.Client.Name),
			Role:          strings.TrimSpace(r.Client.Role),
			ContactPerson: strings.TrimSpace(r.Client.ContactPerson),
			Position:      strings.TrimSpace(r.Client.Position),
			ContactNumber: strings.TrimSpace(r.Client.ContactNumber),
		},
	}
}

// CreateProject — POST /api/projects
func CreateProject() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		orgID := fmt.Sprintf("%v", mustGet(c, "orgId"))
		userID := fmt.Sprintf("%v", mustGet(c, "userId"))

		var req projectRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid request body"})
			return
		}
		if err := req.validate(); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
			return
		}

		p := req.toModel()
		p.ID = primitive.NewObjectID().Hex()
		p.OrgID = orgID
		// Project No. is auto-generated from the org's configured numbering format
		// (Settings → numbering, key "project"), not user-entered.
		p.ProjectNo = nextNumber(ctx, orgID, "project", projectCollection, "projectNo")
		p.CreatedBy = userID
		p.CreatedAt = time.Now()
		p.UpdatedAt = time.Now()

		if _, err := projectCollection.InsertOne(ctx, p); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to create project", "error": err.Error()})
			return
		}
		c.JSON(http.StatusCreated, gin.H{"status": http.StatusCreated, "message": "Project created", "data": p})
	}
}

// GetAllProjects — GET /api/projects?search=
func GetAllProjects() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		orgID := fmt.Sprintf("%v", mustGet(c, "orgId"))

		filter := bson.M{"orgId": orgID}
		if q := strings.TrimSpace(c.Query("search")); q != "" {
			rx := bson.M{"$regex": regexp.QuoteMeta(q), "$options": "i"}
			filter["$or"] = []bson.M{
				{"projectNo": rx}, {"projectName": rx}, {"emirates": rx},
				{"typeOfProject": rx}, {"mainContractor": rx}, {"client.name": rx},
			}
		}

		cur, err := projectCollection.Find(ctx, filter, options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}}))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to list projects", "error": err.Error()})
			return
		}
		defer cur.Close(ctx)
		var projects []models.Project
		cur.All(ctx, &projects)
		if projects == nil {
			projects = []models.Project{}
		}
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "data": projects, "count": len(projects)})
	}
}

// GetProjectByID — GET /api/projects/:id
func GetProjectByID() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		orgID := fmt.Sprintf("%v", mustGet(c, "orgId"))

		var p models.Project
		if err := projectCollection.FindOne(ctx, bson.M{"_id": c.Param("id"), "orgId": orgID}).Decode(&p); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"message": "Project not found"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "data": p})
	}
}

// UpdateProject — PUT /api/projects/:id
func UpdateProject() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		orgID := fmt.Sprintf("%v", mustGet(c, "orgId"))

		var req projectRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "Invalid request body"})
			return
		}
		if err := req.validate(); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
			return
		}

		p := req.toModel()
		// projectNo is auto-assigned at creation and immutable — not in the update set.
		set := bson.M{
			"projectName": p.ProjectName, "emirates": p.Emirates,
			"location": p.Location, "typeOfProject": p.TypeOfProject, "itemsProposed": p.ItemsProposed,
			"mainContractor": p.MainContractor, "subContractors": p.SubContractors,
			"consultants": p.Consultants, "client": p.Client, "updatedAt": time.Now(),
		}
		res, err := projectCollection.UpdateOne(ctx,
			bson.M{"_id": c.Param("id"), "orgId": orgID},
			bson.M{"$set": set},
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to update project", "error": err.Error()})
			return
		}
		if res.MatchedCount == 0 {
			c.JSON(http.StatusNotFound, gin.H{"message": "Project not found"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Project updated"})
	}
}

// DeleteProject — DELETE /api/projects/:id
func DeleteProject() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		orgID := fmt.Sprintf("%v", mustGet(c, "orgId"))

		res, err := projectCollection.DeleteOne(ctx, bson.M{"_id": c.Param("id"), "orgId": orgID})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to delete project", "error": err.Error()})
			return
		}
		if res.DeletedCount == 0 {
			c.JSON(http.StatusNotFound, gin.H{"message": "Project not found"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": http.StatusOK, "message": "Project deleted"})
	}
}
