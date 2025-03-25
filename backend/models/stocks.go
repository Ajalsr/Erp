package stocks

type Stock struct {
	ID    int    `json:"id"`
	Name  string `json:"name"`
	Price int    `json:"price"`
}

var stocks = []Stock{}

func (e Stock) Save() {
	stocks = append(stocks, e)
}
