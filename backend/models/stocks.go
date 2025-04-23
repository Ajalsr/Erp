package models

import "time"

type Stock struct {
	ID       int
	Name     string    `binding:"required"`
	Price    int       `binding:"required"`
	DateTime time.Time `binding:"required"`
}

var stocks = []Stock{}

func (e Stock) Save() {
	stocks = append(stocks, e)
}

func GetAllStocks() []Stock {
	return stocks
}
