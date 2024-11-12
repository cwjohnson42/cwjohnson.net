

const klondike_style = {
	stock: {
	    x: 10,
	    y: 20,
	    spread: {x: 1, y: 0},
    },
    waste: {
        x: 140,
        y: 20,
        peek: 3,
        spread: {x: 20, y: 0},
    },
    foundations: {
        x: 450,
        y: 20,
        pad: 40,
        orient: "horizontal",
        spread: {x: 0, y: 1},
    },
    tableau: {
        x: 10,
        y: 200,
        spread: {x: 0, y: 20},
        pad: 10,
        orient: "horizontal",
    }
}

export const games = {
	klondike: {
		rules: {
			goal: 'foundations',
			deck: {
				cards: 52,
				number: 1,
			},
			foundations: {
				stack: {
					suit: 'same',
					rank: 'asc',
				},
				remove: {
					limit: 1,
				},
				add: {
					limit: 1,
					empty: 1,
				}
			},
			stock: {
				draw: 3,
				refill: 3,
			},
			tableau: {
				stack: {
					suit: 'color-alt',
					rank: 'desc',
				},
				deal: 'klondike',
				remove: {
					limit: null,
					stacked: true,
				},
				add: {
					empty: 13,
				},
			},
			cells: null,
		},
		style: klondike_style,
	}
};
