let realScore = 0;


function restartGame(){
	// reset score, level index, new puzzle (auto reset randomness)
	
}



/* LOGIC */



/* CONTROL */

let touchCountdown = 0;



/* RENDER */

// scaling
function _(n){
	return n/100*width;
}


const TRIANGLE_LENGTH = 26; // out of 100%
const TRIANGLE_HEIGHT = Math.sqrt(3)/2*TRIANGLE_LENGTH;
const BOARD_CENTER = [50, 80];
const BASE_CELLS = [];

// rendering info only
// {x,y, isWest (pointing left), centerRPos[rx,ry], points[rx, ry][3]}
function Cell(x,y){
	this.x = x;
	this.y = y;
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
				stroke(200);
				noFill();
				renderCell(cell);

				fill(255);
				noStroke()
				text((cell.x + cell.y) % 10, cell.centerRPos[0], cell.centerRPos[1]);
			}
		}
	}

}

let mainFont;
function preload(){
	mainFont = loadFont('./Square.ttf');
}