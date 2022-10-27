"use strict";
const LEVELS_INFO = [
	// [amount of removed numbers, amount of multipliers]
	[8, 0],
	[4, 1],
	[0, 3]
];
const SUM_COLOR_SPEED = 0.2;
const PARTICLES_AMOUNT = 5;

let realScore = 0; // gained after each level
let currentLevelScore = 0; // for current level, can be undone
let displayScore = 0; // ANIMATED realScore + currentLevelScore
let displayScoreSize = 1;
let isPaused = true; // block input
let levelIndex = 0;
let levelScores = [0,0,0];
const SCENES = {
	PLAY: 1,
	CONFIRM: 2
};
let scene = SCENES.PLAY;


function restartGame(){
	// reset score, level index, new puzzle (auto reset randomness)
	levelIndex = 0;
	levelScores = [0,0,0];
	realScore = 0;

	sumsList = [
		{rPos: [_(15), _(33)], rotation: -30},
		{rPos: [_(34), _(22)], rotation: -30},
		{rPos: [_(15), _(111)], rotation: 30},
		{rPos: [_(34), _(122)], rotation: 30},

		{rPos: [_(66), _(122)], rotation: -30},
		{rPos: [_(85), _(111)], rotation: -30},
		{rPos: [_(66), _(22)], rotation: 30},
		{rPos: [_(85), _(33)], rotation: 30}
	];
	sumsList.forEach(sumItem => { // same properties
		sumItem.value = 0;
		sumItem.isChecked = false;
		sumItem.transition = 1;
	});

	// set up base cells
	const excludedPos = [
		"0,0", "3,0", "0,6", "3,6"
	];
	const BASE_CELLS = [];
	staticBaseCellsList = [];
	for (let y=0; y<7; y++){
		const row = [];
		for (let x=0; x<4; x++){
			// except these 4 positions
			if (excludedPos.includes(x+","+y)) {
				row.push(null);
			} else {
				const cell = new Cell(x,y);
				row.push(cell);
				staticBaseCellsList.push(cell); // 1D list
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

	generateLevel();
}


// {rPos, rotation, value, isChecked, transition (0-1)}
let sumsList = [];
let usedCells = []; // for generation

const OPERATORS = {
	PLUS: "plus",
	MINUS: "minus",
	TIMES: "times"
};


// replaces random(), must pass an array or 2 numbers
function r(start, end){
	// start isn't number? must be array!
	if (typeof start !== "number"){
		return start[randomInt(0, start.length)];
	}

	// with 2 numbers
	return map(Rune.deterministicRandom(), 0, 1, start, end);
}

function calculateSum(cellsList){
	let finalSum = 0;
	for (let i=0; i<cellsList.length; i++){
		let pCell = cellsList[i];
		if (pCell.numItem.isUsed){ continue; }
		let numItem = pCell.numItem;
		if (numItem.operator === OPERATORS.PLUS){
			finalSum += numItem.value;
		} else if (numItem.operator === OPERATORS.MINUS){
			finalSum -= numItem.value;
		} else if (numItem.operator === OPERATORS.TIMES){
			finalSum *= numItem.value;
		}
	}
	
	return finalSum;
}

// also check if already used then chance to reroll, else add to usedCells
function getRandomCell(cellsList){
	let newCell;
	while (true){
		newCell = r(cellsList);
		// 80% chance to reroll if already used
		if (usedCells.includes(newCell)){
			if (r(0,1) < 0.9) { continue; }
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
	
	let finalSum = calculateSum(pieceCells);
	// validate sum (can't be 0, or beyond 30, or repeated)
	if (finalSum === 0 || finalSum > 30 || finalSum < -30
		|| sumsList.some(s => s.value === finalSum)){
		generateSum(sumIndex); // redo
	} else {
		// set to real sum
		let sumItem = sumsList[sumIndex];
		sumItem.isChecked = false;
		sumItem.value = finalSum;
	}	
}

// setting up new level
function generateLevel(){
	// reset all game states
	scene = SCENES.PLAY;
	currentLevelScore = 0;
	numSpawnIndex = 0;
	displayScore = realScore;
	usedCells = [];
	undoHistory = [];
	particles = [];
	undoButton.isDisabled = true;
	doneButton.isDisabled = true;
	deselect();

	// shuffle baseCellsList
	baseCellsList = staticBaseCellsList.slice(0);
	let temporaryArr = [];
	while (baseCellsList.length > 0){
		temporaryArr.push(
			baseCellsList.splice(
				randomInt(0, baseCellsList.length), 1
			).pop()
		);
	}
	baseCellsList = temporaryArr;

	// generate numItems
	const removedAmount = LEVELS_INFO[levelIndex][0];
	for (let i=0; i<baseCellsList.length - removedAmount;i++){
		let cell = baseCellsList[i];
		cell.numItem = {
			value: randomInt(1, 10),
			// 60% to be positive
			operator: r(0,1) < 0.6? OPERATORS.PLUS : OPERATORS.MINUS,
			size: 0,
			isUsed: false,
			mustBeUsed: false
		};
	}

	// empty cells
	for (let i=baseCellsList.length - removedAmount; i < baseCellsList.length; i++){
		let cell = baseCellsList[i];
		cell.numItem = {
			value: 0,
			operator: OPERATORS.PLUS,
			size: 0,
			isUsed: true,
			mustBeUsed: true
		};
	}

	// add multipliers
	for (let i=0; i<LEVELS_INFO[levelIndex][1]; i++){
		let numItem;
		while (true){
			numItem = r(baseCellsList).numItem;
			// is already TIMES or should be empty? skip
			if (numItem.operator === OPERATORS.TIMES || numItem.mustBeUsed){
				continue;
			}
			numItem.value = randomInt(2,5);
			numItem.operator = OPERATORS.TIMES;
			break;
		}
	}
}

/* CONTROL */

let touchIsDown = false;
let gameInput = {
	selectedCells: [],
	potentialCells: []
};

function selectCell(cell){
	gameInput.selectedCells.push(cell); // becomes piece cell
	// enlargement on selection if not used
	if (!cell.numItem.isUsed){
		cell.numItem.size = 1.5;
	}

	// if have selected 4 cells
	if (gameInput.selectedCells.length >= 4){
		gameInput.potentialCells = []; // no more selectable cell
	} else {
		// remove from potential cells
		const indexOfCell = gameInput.potentialCells.indexOf(cell);
		if (indexOfCell !== -1){
			gameInput.potentialCells.splice(indexOfCell, 1);
		}

		// add potential cells (if exists && not already selected)
		for (let i=0; i<cell.neighbors.length ;i++){
			let nCell = cell.neighbors[i].cell;
			// no need to check !gameInput.potentialCells.includes(nCell) because 3 cells don't share any unselected neighbor
			if (nCell && !gameInput.selectedCells.includes(nCell)){
				gameInput.potentialCells.push(nCell);
			}
		}
		
	}
}

function deselect(){
	gameInput.selectedCells.splice(0, gameInput.selectedCells.length);
	gameInput.potentialCells.splice(0, gameInput.potentialCells.length);
}

function sign(p1, p2, p3){
	return (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1]);
}

function pointInTriangle(pt, v1, v2, v3){
	var d1, d2, d3;
	var has_neg, has_pos;

	d1 = sign(pt, v1, v2);
	d2 = sign(pt, v2, v3);
	d3 = sign(pt, v3, v1);

	has_neg = (d1 < 0) || (d2 < 0) || (d3 < 0);
	has_pos = (d1 > 0) || (d2 > 0) || (d3 > 0);

	return !(has_neg && has_pos);
}

function cellIsHovered(cell){
	return pointInTriangle(
		[mouseX, mouseY], 
		cell.points[0], cell.points[1], cell.points[2]
	);
}

function touchStarted(){
	// already touching or is paused then quit
	if (!touchIsDown && !isPaused){
	touchIsDown = true;	
	} else { return; }

	// PLAY SCENE input
	if (scene === SCENES.PLAY && isDoneSpawning()){
		// check buttons click
		undoButton.checkClicked();
		doneButton.checkClicked();

		// if no selected cell, check hover on all except multipliers (unless used)
		if (gameInput.selectedCells.length === 0){
			for (let i=0; i<baseCellsList.length; i++){
				let cell = baseCellsList[i];
				if (cell.numItem.isUsed || cell.numItem.operator !== OPERATORS.TIMES){
					if (cellIsHovered(cell)){ selectCell(cell); }
				}
			}
		}
		return;
	}

	// CONFIRM SCENE (if still more level)
	if (scene === SCENES.CONFIRM && levelIndex < levelScores.length){
		// within y range?
		if (mouseY < _(115 + 10) && mouseY > _(115 - 10)){
			// cancel button
			if (mouseX < _(25 + 10) && mouseX > _(25 - 10)){
				scene = SCENES.PLAY;
			}
			// confirm button
			else if (mouseX < _(75 + 10) && mouseX > _(75 - 10)){
				// set new score
				levelScores[levelIndex] = currentLevelScore;
				realScore += currentLevelScore;
				levelIndex++;
				if (levelIndex < levelScores.length){
					generateLevel();
				} else {
					Rune.gameOver();
				}
			}
		}
		return;
	}
}

function sumMatched(cellsList, sumItem){
	// add to undo history item: cellsList of unused cells and sumItem
	undoHistory.push({
		cellsList: cellsList.filter(c => !c.numItem.isUsed),
		sumItem: sumItem
	});
	undoButton.isDisabled = false;
	doneButton.isDisabled = false;

	// collect numbers on given cells if not already used
	for (let i=0; i<cellsList.length ;i++){
		let c = cellsList[i];
		// add to currentLevelScore
		if (!c.numItem.isUsed){
			currentLevelScore += 10;
			// add animated dots
			particlize(c.centerRPos[0], c.centerRPos[1]);
			c.numItem.isUsed = true;
		}
	}
}


function touchEnded(){
	if (touchIsDown && !isPaused){
		touchIsDown = false;

		// apply selected cells
		if (gameInput.selectedCells.length > 0){
			let inputSum = calculateSum(gameInput.selectedCells);
			// check if match any unchecked sum
			for (let i=0; i<sumsList.length ;i++){
				let sumItem = sumsList[i];
				// not matched or already checked? skip
				if (sumItem.isChecked || sumItem.value !== inputSum){continue;}
				sumItem.isChecked = true;
				sumMatched(gameInput.selectedCells, sumItem);
				break;
			}
			deselect();
		}

	}
}



let undoHistory = []; // {cellsList, sumItem}

function undo(){
	if (undoHistory.length > 0){
		let undoItem = undoHistory.pop();
		undoItem.sumItem.isChecked = false;
		for (let i=0; i< undoItem.cellsList.length; i++){
			let c = undoItem.cellsList[i];
			if (!c.numItem.mustBeUsed) {
				c.numItem.isUsed = false;
				c.numItem.size = 1.5;
				currentLevelScore -= 10;
			}
		}

		// failsafe when out of undos: restore all numbers & sums, reset current score
		if (undoHistory.length === 0){
			currentLevelScore = 0;
			for (let i=0; i< baseCellsList.length; i++){
				let c = baseCellsList[i];
				// not empy cell?
				if (!c.numItem.mustBeUsed) {
					c.numItem.isUsed = false;
					if (c.numItem.size < 1){
						c.numItem.size = 1;
					}
				}
			}
			for (let i=0; i< undoItem.cellsList.length; i++){
				sumsList[i].isChecked = false;
			}
			undoButton.isDisabled = true;
			doneButton.isDisabled = true;
		}

		displayScore = realScore + currentLevelScore;
		particles.splice(0, particles.length);;
		deselect();
	}
}



/* RENDER */

// scaling
function _(n){
	return n/100*width;
}

function randomInt(start, end){
	return floor(r(start, end));
}

const TRIANGLE_LENGTH = 26; // out of 100%
const TRIANGLE_HEIGHT = Math.sqrt(3)/2*TRIANGLE_LENGTH;
const BOARD_CENTER = [50, 72];
const DISPLAY_SCORE_CENTER = [20, 10];
let staticBaseCellsList = [];
let baseCellsList = [];

// rendering info only
/* Cell {
	x,y, isWest (pointing left), 
	centerRPos[rx,ry], points[rx, ry][3], 
	neighbors {cell, border}[], 
	numItem    null | { size, value, operator, isUsed, mustBeUsed }
}*/
function Cell(x,y){
	// neighbors contains 3 of {cell: null | Cell, border: [point1, point2]}
	// if cell is null then it doesn't exist
	this.neighbors = [];
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

let particles = []; // {x,y, vx, vy, timer}
// spawn particles at given position
function particlize(x, y){
	const deg = 360 / PARTICLES_AMOUNT;
	for (let i=0; i < PARTICLES_AMOUNT; i++){
		particles.push({
			x: x, y: y, 
			vx: _(sin(deg*i)), vy: _(cos(deg*i)), 
			timer: floor(random(10, 20))
		});
	}
}

let undoButton, doneButton;

let COLORS = {};
function setup(){
	const HEIGHT_RATIO = 1.4;
	const CANVAS_WIDTH = min(
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
		RED: color(220, 140, 30)
	}

	undoButton = new Button(_(85), _(128),
		function(){
			line(
				this.x + _(3), this.y + _(3), 
				this.x + _(3), this.y - _(3)
			);
			line(
				this.x - _(3), this.y - _(3), 
				this.x + _(3), this.y - _(3)
			);
			line(
				this.x - _(3), this.y + _(3), 
				this.x - _(3), this.y - _(3)
			);
			line(
				this.x - _(3), this.y + _(3), 
				this.x - _(5), this.y
			);
			line(
				this.x - _(3), this.y + _(3), 
				this.x - _(1), this.y
			);
	}, undo);

	doneButton = new Button(_(85), _(12),
		function(){
			line(
				this.x - _(3), this.y, 
				this.x - _(1.5), this.y + _(3)
			);
			line(
				this.x + _(3), this.y - _(3), 
				this.x - _(1.5), this.y + _(3)
			);
		}, function(){
			scene = SCENES.CONFIRM;
	});

	restartGame();
	
	// isPaused = false; // without Rune
	
	Rune.init({
		resumeGame: function () {
			isPaused = false;
		},
		pauseGame: function () {
			isPaused = true;
		},
		restartGame: function () {
			restartGame();
		},
		getScore: function () {
			return max(0, realScore);
		}
	});


}

function playSceneDraw(){
	// grid
	strokeWeight(_(0.7));
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
		let numItem = cell.numItem;

		// update size
		if (numItem.isUsed){
			if (numItem.size > 0){ // shrink to nothingness
				numItem.size = max(0, numItem.size - 0.1);
			}
		} else {
			if (numItem.size > 1){ // shrink to normal
				numItem.size = max(1, numItem.size - 0.1);
			}
		}

		// render number
		if (numItem.size > 0){
			textSize(_(10) * numItem.size);
			if (numItem.operator === OPERATORS.PLUS){
				fill(COLORS.WHITE);
				text("+"+ numItem.value, cell.centerRPos[0], cell.centerRPos[1]);
			} else if (numItem.operator === OPERATORS.MINUS){
				fill(COLORS.RED);
				text("-"+ numItem.value, cell.centerRPos[0], cell.centerRPos[1]);
			} else if (numItem.operator === OPERATORS.TIMES){
				fill(COLORS.GREEN);
				text("×"+ numItem.value, cell.centerRPos[0], cell.centerRPos[1]);
			}
		}
	}

	let currentSum = calculateSum(gameInput.selectedCells);
	let sumIsMatched = false;
	for (let i=0; i<sumsList.length; i++){
		let sumItem = sumsList[i];
		if (!sumItem.isChecked && sumItem.value === currentSum){
			sumIsMatched = true;
			break;
		}
	}

	// potential cells outline
	strokeWeight(_(0.8));
	stroke(COLORS.RED);
	for (let i=0; i<gameInput.potentialCells.length; i++){
		let potentialCell = gameInput.potentialCells[i];
		for (let j=0; j<potentialCell.neighbors.length; j++){
			let neighborItem = potentialCell.neighbors[j];
			// border with anything except selected and potential cells
			if (!gameInput.selectedCells.includes(neighborItem.cell) && 
			!gameInput.potentialCells.includes(neighborItem.cell)){
				line(
					neighborItem.border[0][0],
					neighborItem.border[0][1],
					neighborItem.border[1][0],
					neighborItem.border[1][1]
				);
			}
		}
	}

	// selected cells outline
	stroke(sumIsMatched? COLORS.GREEN : COLORS.WHITE);
	strokeWeight(_(1.4));
	for (let i=0; i<gameInput.selectedCells.length; i++){
		let selectedCell = gameInput.selectedCells[i];
		for (let j=0; j<selectedCell.neighbors.length; j++){
			let neighborItem = selectedCell.neighbors[j];
			// border with anything not selected
			if (!gameInput.selectedCells.includes(neighborItem.cell)){
				line(
					neighborItem.border[0][0],
					neighborItem.border[0][1],
					neighborItem.border[1][0],
					neighborItem.border[1][1]
				);
			}
		}
	}

	// update displayScore (if no particle animating)
	if (particles.length === 0){
		const targetDisplayScore = realScore + currentLevelScore;
		if (displayScore > targetDisplayScore){
			displayScore--;
		} else if (displayScore < targetDisplayScore) {
			displayScore++;
		}
		if (displayScoreSize > 1){
			displayScoreSize = max(1, displayScoreSize - 0.2);
		}
	}

	// display score
	textSize(_(10*displayScoreSize)); noStroke();
	fill(displayScoreSize > 1 ? COLORS.GREEN : COLORS.WHITE);
	text(displayScore, _(DISPLAY_SCORE_CENTER[0]), _(DISPLAY_SCORE_CENTER[1]));

	// level text
	textSize(_(6));
	fill(COLORS.GRAY);
	text("LVL " + (levelIndex+1), _(15), _(130));

	// only if done spawning numbers
	if (isDoneSpawning()){
		// if selected any cell then check hover potential cells to directly select
		if (gameInput.selectedCells.length !== 0 && touchIsDown) {
			for (let i=0; i<gameInput.potentialCells.length; i++){
				let cell = gameInput.potentialCells[i];
				if (cellIsHovered(cell)){ selectCell(cell); }
			}
		}

		// sums
		textSize(_(8));
		noStroke();
		for (let i=0; i<sumsList.length; i++){
			let sumItem = sumsList[i];
			push();
			translate(sumItem.rPos[0], sumItem.rPos[1]);
			rotate(sumItem.rotation);
			
			fill(lerpColor(COLORS.WHITE, COLORS.GRAY, sumItem.transition));
			text(sumItem.value, 0, 0);

			if (sumItem.isChecked) { // checked then go towards 1
				if (sumItem.transition < 1){
					sumItem.transition = min(1, sumItem.transition + SUM_COLOR_SPEED);
				}
			} else {
				if (sumItem.transition > 0){
					sumItem.transition = max(0, sumItem.transition - SUM_COLOR_SPEED);
				}
			}
			pop();
		}

		// current sum display
		if (gameInput.selectedCells.length > 0){
			let renderY = mouseY - _(23);
			strokeWeight(_(0.5)); 
			stroke(sumIsMatched? COLORS.GREEN : COLORS.WHITE); 
			fill(COLORS.BG);
			beginShape();
			vertex(mouseX - _(7), renderY - _(5));
			vertex(mouseX + _(7), renderY - _(5));
			vertex(mouseX + _(7), renderY + _(5));
			vertex(mouseX, renderY + _(8));
			vertex(mouseX - _(7), renderY + _(5));
			endShape(CLOSE);

			fill(sumIsMatched? COLORS.GREEN : COLORS.WHITE); 
			noStroke(); textSize(_(8));
			text(currentSum, mouseX, renderY);
		}
	} else if (!isPaused) {
		// update sum generation
		generateSum(numSpawnIndex);
		
		// update spawning
		let numItem = baseCellsList[numSpawnIndex].numItem;
		// not empty cell?
		if (!numItem.mustBeUsed) {
			numItem.size = 1.8;
			numItem.isUsed = false;
		}
		numSpawnIndex++;
	}

	// particles
	fill(COLORS.WHITE);
	for (let i=particles.length-1; i >= 0; i--){
		let pc = particles[i];
		// update velocity and position
		if (pc.timer-- <= 0){
			const diffX = _(DISPLAY_SCORE_CENTER[0]) - pc.x;
			const diffY = _(DISPLAY_SCORE_CENTER[1]) - pc.y;
			pc.vx = diffX*0.1;
			pc.vy = min(_(-2), diffY*0.1);
		}
		pc.x += pc.vx;
		pc.y += pc.vy;
		square(pc.x, pc.y, _(2));

		// remove if above display score
		if (pc.y < _(DISPLAY_SCORE_CENTER[1])){
			particles.splice(i, 1);
			displayScoreSize = 1.8; // enlarge score
			displayScore += 10/PARTICLES_AMOUNT;
		}
	}

	// buttons
	undoButton.draw();
	doneButton.draw();
}


function draw(){
	clickCooldown--;
    background(COLORS.BG);

	// PLAY SCENE
	if (scene === SCENES.PLAY){
		playSceneDraw();
		return;
	}	

	// CONFIRM SCENE
	if (scene === SCENES.CONFIRM){
		let totalScore = 0;
		// render level texts and scores
		textAlign(LEFT, CENTER);
		noStroke();
		textSize(_(12));
		for (let i=0; i<levelScores.length; i++){
			fill(COLORS.WHITE);
			text("LVL " + (i + 1), _(15), _(25 + i*15));
			// blinking score if is current level
			let score = 0;
			if (levelIndex === i){
				fill(lerpColor(COLORS.BG, COLORS.GREEN, abs(cos(frameCount*5))));
				score = currentLevelScore;
			} else {
				fill(COLORS.GREEN);
				score = levelScores[i];
			}
			text(score, _(65), _(25 + i*15));
			totalScore += score;
		}
		textAlign(CENTER, CENTER);

		// total score
		textSize(_(20));
		fill(COLORS.WHITE);
		for (let i=0; i<7; i++){
			let t = frameCount*4 + 40*i;
			square(_(cos(t)*20 + 50), _(sin(t*2)*10 + 80), _(4));
		}
		text(totalScore, _(50), _(80));

		// don't render button if no more level
		if (levelIndex >= levelScores.length){ return; }
		
		strokeWeight(_(3));
		fill(COLORS.WHITE);

		// confirm button
		noStroke();
		square(_(75),_(115), _(20), _(2));
		stroke(COLORS.BG);
		line(_(72),_(120),_(80),_(110));
		line(_(72),_(120),_(70),_(115));

		// cancel button
		noStroke();
		square(_(25),_(115), _(20), _(2));
		stroke(COLORS.BG);
		line(_(20),_(110), _(30),_(120));
		line(_(20),_(120), _(30),_(110));
		
		return;
	}
}

let clickCooldown = 0;
function Button(x,y, render, action){
	this.x = x;
	this.y = y;
	this.size = _(7);
	this.isDisabled = true;
	this.transition = 0; // 0 is disabled
	this.render = render;
	this.action = action;
}
Button.prototype.draw = function(){
	if (this.isDisabled){
		if (this.transition > 0){ 
			this.transition = max(0, this.transition - 0.2);
		}
	} else {
		if (this.transition < 1){ 
			this.transition = min(1, this.transition + 0.2);
		}
	}
	
	noStroke();
	fill(lerpColor(COLORS.GRAY, COLORS.WHITE, this.transition));
	rect(this.x, this.y, this.size*2, this.size*2 - _(2), _(1.5));
	stroke(COLORS.BG); strokeWeight(_(1.5));
	this.render();
}
Button.prototype.checkClicked = function(){
	const isHovered = mouseX > this.x - this.size && mouseX < this.x + this.size &&
	mouseY > this.y - this.size && mouseY < this.y + this.size;
	if (isHovered && !this.isDisabled && clickCooldown < 0){
		this.action();
		clickCooldown = 5;
		return;
	}
}

function isDoneSpawning(){
	return numSpawnIndex >= baseCellsList.length;
}

let mainFont;
function preload(){
	mainFont = loadFont('./Square.ttf');
}