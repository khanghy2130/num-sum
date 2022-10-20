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

const BASE_CELLS = [];

// rendering info only
// {x,y, isWest (pointing left), centerRPos[rx,ry], points[rx, ry][3]}
function Cell(x,y){
	this.x = x;
	this.y = y;
	this.isWest = (x+y) % 2 !== 0;

	this.centerRPos = [
		// center-x-grid + x-order + (isWest? big part of TH : small part of TH)
		_(50 + (x-2) * TRIANGLE_HEIGHT + (
			this.isWest? TRIANGLE_HEIGHT - TRIANGLE_LENGTH/4 :  TRIANGLE_LENGTH/4 
		)),
		// center-y-grid + y-order
		_(70 + (y-3) * TRIANGLE_LENGTH/2)
	];

	this.points = [
		// vertical line
		[
			0,
			0
		]
		// upper diagonal line
		[
			0,
			0
		]
		// lower diagonal line
		[
			0,
			0
		]
	];
}

function renderCell(cell){
	/////// use triangle() on the points
	circle(cell.centerRPos[0], cell.centerRPos[1], _(5));
	//text(cell.x+","+cell.y, cell.centerRPos[0], cell.centerRPos[1]);
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
	fill(255);
	//strokeWeight(_(1));
	//noFill();
	for (let y=0; y<7; y++){
		for (let x=0; x<4; x++){
			let cell = BASE_CELLS[y][x];
			if (cell) {renderCell(cell);}
		}
	}

}

let mainFont;
function preload(){
	mainFont = loadFont('./Square.ttf');
}