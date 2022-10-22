let realScore = 0;


function restartGame(){
	// reset score, level index, new puzzle (auto reset randomness)
	
}




// {rPos, rotation, value, isChecked}
let sumsList = [];
let usedCells = []; // for generation

const OPERATORS = {
	PLUS: "plus",
	MINUS: "minus",
	TIMES: "times"
};

// also check if already used then chance to reroll, else add to usedCells
function getRandomCell(cellsList){
	let newCell;
	while (true){
		newCell = random(cellsList);
		// 80% chance to reroll if already used
		if (usedCells.includes(newCell)){
			if (random() < 0.9) { continue; }
		} 
		else { usedCells.push(newCell); }
		break;
	}
	return newCell;
}

function generateSum(sumIndex){
	if (sumIndex >= sumsList.length){ return; }
	
	let pieceLength = randomInt(3,5); // 3 and 4
	let potentialNextCells = [];
	let pieceCells = [];
	
	// pick a random starting cell
	let rootCell;
	while (true){
		rootCell = getRandomCell(baseCellsList);
		// don't pick multiplier
		if (rootCell.numItem.operator === OPERATORS.TIMES){ continue; }
		break;
	}
	potentialNextCells = [rootCell];

	// pick a random cell, add next cell to piece
	while (pieceLength > pieceCells.length && potentialNextCells.length > 0){
		let nextCell = getRandomCell(potentialNextCells);
		pieceCells.push(nextCell); // add to piece
		// create new potential list without any piece cell
		potentialNextCells = [];
		for (let i=0; i < pieceCells.length; i++){
			let neighbors = pieceCells[i].neighbors;
			for (let j=0; j < neighbors.length; j++){
				let nCell = neighbors[j].cell;
				if (nCell && !pieceCells.includes(nCell)){
					potentialNextCells.push(nCell);
				}
			}
		}
	}
	
	let finalSumValue = 0;
	pieceCells.forEach(pCell => {
		let numItem = pCell.numItem;
		console.log(numItem.operator + " " + numItem.value);//////
		if (numItem.operator === OPERATORS.PLUS){
			finalSumValue += numItem.value;
		} else if (numItem.operator === OPERATORS.MINUS){
			finalSumValue -= numItem.value;
		} else if (numItem.operator === OPERATORS.TIMES){
			finalSumValue *= numItem.value;
		}
	});
	console.log(finalSumValue + " (length: " + pieceCells.length +")");

	// validate sum (can't be 0, or beyond 30, or repeated)
	if (finalSumValue === 0 || finalSumValue > 30 || finalSumValue < -30
		|| sumsList.some(s => s.value === finalSumValue)){
		console.log("regenerating sum..."); /////
		generateSum(sumIndex);
	} else {
		// set to real sum
		let sumItem = sumsList[sumIndex];
		sumItem.isChecked = false;
		sumItem.value = finalSumValue;
	}	
}

// setting up new level
function generateLevel(){
	// reset all game states ///////
	numSpawnIndex = 0;
	usedCells = [];

	// generate numItems
	baseCellsList.forEach(cell => {
		cell.numItem = {
			value: randomInt(1, 10),
			// 60% to be positive
			operator: random() < 0.6? OPERATORS.PLUS : OPERATORS.MINUS,
			size: 0
		};
	});
	// add 3 multipliers
	for (let i=0; i<3; i++){
		let numItem;
		while (true){
			numItem = random(baseCellsList).numItem;
			// is already TIMES?
			if (numItem.operator === OPERATORS.TIMES){
				continue;
			}
			numItem.value = randomInt(2,5);
			numItem.operator = OPERATORS.TIMES;
			break;
		}
	}

}

/* CONTROL */

let touchCountdown = 0;



/* RENDER */

// scaling
function _(n){
	return n/100*width;
}

function randomInt(start, end){
	return floor(random(start, end));
}

const TRIANGLE_LENGTH = 26; // out of 100%
const TRIANGLE_HEIGHT = Math.sqrt(3)/2*TRIANGLE_LENGTH;
const BOARD_CENTER = [50, 70];
const BASE_CELLS = [];
let baseCellsList = [];

// rendering info only
// {x,y, isWest (pointing left), centerRPos[rx,ry], points[rx, ry][3], neighbors{cell, border}[], numItem}
function Cell(x,y){
	// neighbors contains 3 of {cell: null | Cell, border: [point1, point2]}
	// if cell is null then it doesn't exist
	this.neighbors = [];
	// null | {value, size(1.0 is normal)}
	this.numItem = null;
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

let numSpawnIndex = 0; // block input if this isn't done (= baseCellsList.length)

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
	strokeJoin(ROUND);
	
	COLORS = {
		BG: color(23, 15, 48),
		WHITE: color(200, 175, 255),
		GRAY: color(80, 70, 148),
		GREEN: color(15, 220, 100),
		RED: color(220, 120, 20)
	}

	// set up sums list
	sumsList = [
		{ rPos: [_(15), _(30)], rotation: -30, value: 0, isChecked: false },
		{ rPos: [_(34), _(19)], rotation: -30, value: 0, isChecked: false },
		{ rPos: [_(15), _(111)], rotation: 30, value: 0, isChecked: false },
		{ rPos: [_(34), _(122)], rotation: 30, value: 0, isChecked: false },

		{ rPos: [_(66), _(122)], rotation: -30, value: 0, isChecked: false },
		{ rPos: [_(85), _(111)], rotation: -30, value: 0, isChecked: false },
		{ rPos: [_(66), _(19)], rotation: 30, value: 0, isChecked: false },
		{ rPos: [_(85), _(30)], rotation: 30, value: 0, isChecked: false }
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
				const cell = new Cell(x,y);
				row.push(cell);
				baseCellsList.push(cell); // 1D list
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

	// shuffle baseCellsList
	let temporaryArr = [];
	while (baseCellsList.length > 0){
		temporaryArr.push(
			baseCellsList.splice(randomInt(0, baseCellsList.length),1).pop()
		);
	}
	baseCellsList = temporaryArr;

	generateLevel();

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
    background(COLORS.BG);

	// grid
	strokeWeight(_(0.8));
	stroke(COLORS.GRAY);
	noFill();
	for (let i=0; i<baseCellsList.length; i++){
		let cell = baseCellsList[i];
		renderCell(cell);
	}

	// num items
	noStroke();
	for (let i=0; i<baseCellsList.length; i++){
		let cell = baseCellsList[i];
		// update size if bigger than normal
		if (cell.numItem.size > 1){
			cell.numItem.size = max(1, cell.numItem.size - 0.1);
		}
		textSize(_(10) * cell.numItem.size);
		if (cell.numItem.operator === OPERATORS.PLUS){
			fill(COLORS.WHITE);
			text("+"+cell.numItem.value, cell.centerRPos[0], cell.centerRPos[1]);
		} else if (cell.numItem.operator === OPERATORS.MINUS){
			fill(COLORS.RED);
			text("-"+cell.numItem.value, cell.centerRPos[0], cell.centerRPos[1]);
		} else if (cell.numItem.operator === OPERATORS.TIMES){
			fill(COLORS.GREEN);
			text("×"+cell.numItem.value, cell.centerRPos[0], cell.centerRPos[1]);
		}
	}

	if (isDoneSpawning()){
		// sums
		textSize(_(8));
		noStroke();
		for (let i=0; i<sumsList.length; i++){
			let sum = sumsList[i];
			push();
			translate(sum.rPos[0], sum.rPos[1]);
			rotate(sum.rotation);
			// draw box if checked out
			fill(COLORS.WHITE);
			if (sum.isChecked) {
				rect(0,0, _(14), _(9));
				fill(COLORS.BG);
				text(sum.value, 0, 0);
			} else {
				text(sum.value, 0, 0);
			}
			pop();
		}
	} else {
		// update spawning & generating sum
		//////// don't if viewing tutorial
		generateSum(numSpawnIndex);
		baseCellsList[numSpawnIndex].numItem.size = 1.8;
		numSpawnIndex++;
	}

}

function isDoneSpawning(){
	return numSpawnIndex >= baseCellsList.length;
}

let mainFont;
function preload(){
	mainFont = loadFont('./Square.ttf');
}