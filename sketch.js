let realScore = 0;


function restartGame(){
	// reset score, level index, new puzzle (auto reset randomness)
	
}



/* LOGIC */

// {rPos, rotation, value}
let sumsList = [];


/* CONTROL */

let touchCountdown = 0;



/* RENDER */

// scaling
function _(n){
	return n/100*width;
}


const TRIANGLE_LENGTH = 26; // out of 100%
const TRIANGLE_HEIGHT = Math.sqrt(3)/2*TRIANGLE_LENGTH;
const BOARD_CENTER = [50, 70];
const BASE_CELLS = [];

// rendering info only
// {x,y, isWest (pointing left), centerRPos[rx,ry], points[rx, ry][3], neighbors, numItem}
function Cell(x,y){
	// neighbors contains 3 of {cell: null | Cell, border: [point1, point2]}
	// if cell is null then it doesn't exist
	this.neighbors = [];
	this.numItem = null; // null | {value, size}
	this.isWest = (x+y) % 2 !== 0;
	
	this.centerRPos = [
		// center-x-grid + x-order + (isWest? big part of TH : small part of TH)
		_(BOARD_CENTER[0] + (x-2) * TRIANGLE_HEIGHT + (
			this.isWest? TRIANGLE_HEIGHT - TRIANGLE_LENGTH/4 : TRIANGLE_LENGTH/4 
		)),
		// center-y-grid + y-order
		_(BOARD_CENTER[1] + (y-3) * TRIANGLE_LENGTH/2)
	];

	this.points = [
		// middle point
		[
			_(BOARD_CENTER[0] + (x-2) * TRIANGLE_HEIGHT + (
				this.isWest? 0 :  TRIANGLE_HEIGHT 
			)),
			_(BOARD_CENTER[1] + (y-3) * TRIANGLE_LENGTH/2)
		],
		// upper point
		[
			_(BOARD_CENTER[0] + (x-2) * TRIANGLE_HEIGHT + (
				this.isWest? TRIANGLE_HEIGHT : 0 
			)),
			_(BOARD_CENTER[1] + (y-4) * TRIANGLE_LENGTH/2)
		],
		// lower point
		[
			_(BOARD_CENTER[0] + (x-2) * TRIANGLE_HEIGHT + (
				this.isWest? TRIANGLE_HEIGHT : 0 
			)),
			_(BOARD_CENTER[1] + (y-2) * TRIANGLE_LENGTH/2)
		]
	];
}

function renderCell(cell){
	triangle(
		cell.points[0][0],
		cell.points[0][1],
		cell.points[1][0],
		cell.points[1][1],
		cell.points[2][0],
		cell.points[2][1]
	);
}

let COLORS = {};
function setup(){
	HEIGHT_RATIO = 1.4;
	CANVAS_WIDTH = min(
		document.documentElement.clientWidth,
		document.documentElement.clientHeight/HEIGHT_RATIO
	);
	createCanvas(
		CANVAS_WIDTH,
		CANVAS_WIDTH*HEIGHT_RATIO
	).parent("overlay");


	textFont(mainFont);
	frameRate(30);
	textAlign(CENTER, CENTER);
	rectMode(CENTER);
	angleMode(DEGREES);
	
	COLORS = {
		BG: color(10, 10, 10),
		WHITE: color(250, 250, 250),
		GREEN: color(20, 230, 20),
		RED: color(230, 20, 20)
	}

	// set up sums list
	sumsList = [
		{ rPos: [_(12), _(31)], rotation: -30, value: -99 },
		{ rPos: [_(34), _(19)], rotation: -30, value: -99 },
		{ rPos: [_(64), _(122)], rotation: -30, value: -99 },
		{ rPos: [_(85), _(110)], rotation: -30, value: -99 }
	];

	// set up base cells
	const excludedPos = [
		"0,0", "3,0", "0,6", "3,6"
	];
	for (let y=0; y<7; y++){
		const row = [];
		for (let x=0; x<4; x++){
			// except these 4 positions
			if (excludedPos.includes(x+","+y)) {
				row.push(null);
			} else {
				row.push(new Cell(x,y));
			}
		}
		BASE_CELLS.push(row);
	}
	// set up neighbors
	for (let y=0; y<7; y++){
		for (let x=0; x<4; x++){
			let cell = BASE_CELLS[y][x];
			if (cell){
				let topNeighbor, bottomNeighbor, sideNeighbor;
				topNeighbor = y - 1 >= 0? BASE_CELLS[y-1][x] : null;
				bottomNeighbor = y + 1 < 7? BASE_CELLS[y+1][x] : null;
				if (cell.isWest){
					sideNeighbor = x + 1 < 4? BASE_CELLS[y][x + 1] : null;
				} else {
					sideNeighbor = x - 1 >= 0? BASE_CELLS[y][x - 1] : null;
				}

				cell.neighbors.push({
					cell: topNeighbor,
					border: [
						cell.points[0],
						cell.points[1]
					]
				});
				cell.neighbors.push({
					cell: bottomNeighbor,
					border: [
						cell.points[0],
						cell.points[2]
					]
				});
				cell.neighbors.push({
					cell: sideNeighbor,
					border: [
						cell.points[1],
						cell.points[2]
					]
				});

			}
		}
	}



	Rune.init({
		resumeGame: function () {
			
		},
		pauseGame: function () {
			
		},
		restartGame: function () {
			restartGame();
		},
		getScore: function () {
			return max(0, realScore);
		}
	});
}


function draw(){
	touchCountdown--;
    background(0);

	// for each base cell
	strokeWeight(_(0.5));
	textSize(_(12));
	for (let y=0; y<7; y++){
		for (let x=0; x<4; x++){
			let cell = BASE_CELLS[y][x];
			if (cell) {
				stroke(150);
				noFill();
				renderCell(cell);

				fill(255);
				noStroke();
				text("9", cell.centerRPos[0], cell.centerRPos[1]);

			}
		}
	}

	// sums
	textSize(_(8));
	noStroke();
	for (let i=0; i<sumsList.length; i++){
		let sum = sumsList[i];
		push();
		translate(sum.rPos[0], sum.rPos[1]);
		rotate(sum.rotation);
		// draw box if checked out
		fill(COLORS.GREEN);
		if (!false) {
			rect(0,0, _(14), _(9));
			fill(COLORS.BG);
			text(sum.value, 0, 0);
		} else {
			text(sum.value, 0, 0);
		}
		pop();
	}

}

let mainFont;
function preload(){
	mainFont = loadFont('./Square.ttf');
}