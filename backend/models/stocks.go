package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Stock struct {
	ID               primitive.ObjectID `json:"_id,omitempty" bson:"_id,omitempty"`
	Name             string             `json:"name" bson:"name"`
	ItemCode         string             `json:"item_code" bson:"item_code"`
	Unit             string             `json:"Unit" bson:"unit"`
	Length           string             `json:"length" bson:"length"`
	Width            string             `json:"width" bson:"width"`
	Height           string             `json:"height" bson:"height"`
	DimensionUnit    string             `json:"dimension_unit" bson:"dimension_unit"`
	Weight           string             `json:"weight" bson:"weight"`
	Manufacturer     string             `json:"manufacturer" bson:"manufacturer"`
	Brand            string             `json:"brand" bson:"brand"`
	UPC              string             `json:"upc" bson:"upc"`
	EAN              string             `json:"ean" bson:"ean"`
	MPN              string             `json:"mpn" bson:"mpn"`
	ISBN             string             `json:"isbn" bson:"isbn"`
	SellingPrice     string             `json:"selling_price" bson:"selling_price"`
	SalesAccount     string             `json:"sales_account" bson:"sales_account"`
	SalesDescription string             `json:"sales_description" bson:"sales_description"`
	CostPrice        string             `json:"cost_price" bson:"cost_price"`
	CostAccount      string             `json:"cost_account" bson:"cost_account"`
	CostDescription  string             `json:"cost_description" bson:"cost_description"`
	PreferredVendor  string             `json:"preferred_vendor" bson:"preferred_vendor"`
	InventoryAccount string             `json:"inventory_account" bson:"inventory_account"`
	OpeningStock     string             `json:"opening_stock" bson:"opening_stock"`
	OpeningStockRate string             `json:"opening_stock_rate" bson:"opening_stock_rate"`
	ReorderPoint     string             `json:"reorder_point" bson:"reorder_point"`
	Quantity         string             `json:"quantity" bson:"quantity"`
	OrgID            string             `json:"orgId,omitempty" bson:"orgId,omitempty"`
	CreatedAt        time.Time          `json:"created_at" bson:"created_at"`
	UpdatedAt        time.Time          `json:"updated_at" bson:"updated_at"`
	CreatedBy        string             `json:"created_by" bson:"created_by"`
	Category         string             `json:"category" bson:"category"`
	SKU              string             `json:"sku" bson:"sku"`
	Type             string             `json:"type" bson:"type"`
}
