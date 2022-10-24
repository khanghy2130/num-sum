const SUM_COLOR_SPEED = 0.2;
const PARTICLES_AMOUNT = 5;

let soundEffect = {src: "soundeffect.wav", vol: 1.0};
const allSounds = [soundEffect];
function playSoundEffect(){
	if (soundEffect.sound){
		soundEffect.sound.play();
	}
}


let realScore = 0; // gained after each level
let currentLevelScore = 0; // for current level, can be undone
let displayScore = 0; // ANIMATED realScore + currentLevelScore
let displayScoreSize = 1;
let isPaused = true; // block input

function restartGame(){
	// reset score, level index, new puzzle (auto reset randomness)
	
}




// {rPos, rotation, value, isChecked, transition (0-1)}
let sumsList = [];
let usedCells = []; // for generation

const OPERATORS = {
	PLUS: "plus",
	MINUS: "minus",
	TIMES: "times"
};

function calculateSum(cellsList){
	let finalSum = 0;
	cellsList.forEach(pCell => {
		if (pCell.numItem.isUsed){ return; }
		let numItem = pCell.numItem;
		if (numItem.operator === OPERATORS.PLUS){
			finalSum += numItem.value;
		} else if (numItem.operator === OPERATORS.MINUS){
			finalSum -= numItem.value;
		} else if (numItem.operator === OPERATORS.TIMES){
			finalSum *= numItem.value;
		}
	});
	return finalSum;
}

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
	// reset all game states ///////
	numSpawnIndex = 0;
	usedCells = [];
	deselect();
	undoHistory = [];

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
		playSoundEffect();
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
		cell.neighbors.forEach(neighborItem => {
			let nCell = neighborItem.cell;
			// no need to check !gameInput.potentialCells.includes(nCell) because 3 cells don't share any unselected neighbor
			if (nCell && !gameInput.selectedCells.includes(nCell)){
				gameInput.potentialCells.push(nCell);
			}
		});
	}
}

function deselect(){
	gameInput = {
		selectedCells: [],
		potentialCells: []
	};
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
	// check circular range then triangle points
	return dist(mouseX, mouseY, cell.centerRPos[0], cell.centerRPos[1]) < _(12) && 
	pointInTriangle([mouseX, mouseY], cell.points[0], cell.points[1], cell.points[2]);
}

function touchStarted(){
	if (!touchIsDown && isDoneSpawning() && !isPaused){
		touchIsDown = true;

		// if no selected cell, check hover on all except multipliers (unless used)
		if (gameInput.selectedCells.length === 0){
			for (let i=0; i<baseCellsList.length; i++){
				let cell = baseCellsList[i];
				if (cell.numItem.isUsed || cell.numItem.operator !== OPERATORS.TIMES){
					if (cellIsHovered(cell)){ selectCell(cell); }
				}
			}
		}

		// check button click //////
	}
}

function sumMatched(cellsList, sumItem){
	// add to undo history item: cellsList of unused cells and sumItem
	undoHistory.push({
		cellsList: cellsList.filter(c => !c.numItem.isUsed),
		sumItem: sumItem
	});

	// collect numbers on given cells if not already used
	cellsList.forEach(c => {
		// add to currentLevelScore
		if (!c.numItem.isUsed){
			currentLevelScore += 10;
			// add animated dots
			particlize(c.centerRPos[0], c.centerRPos[1]);
			c.numItem.isUsed = true;
		}
	});
}


function touchEnded(){
	if (touchIsDown && !isPaused){
		touchIsDown = false;

		// apply selected cells
		if (gameInput.selectedCells.length > 0){
			let inputSum = calculateSum(gameInput.selectedCells);
			// check if match any unchecked sum
			sumsList.some(sumItem => {
				// not matched or already checked? skip
				if (sumItem.isChecked || sumItem.value !== inputSum){return false;}
				sumItem.isChecked = true;
				sumMatched(gameInput.selectedCells, sumItem);
				return true;
			});
			deselect();
		}

	}
}

let undoHistory = []; // {cellsList, sumItem}

function undo(){
	if (undoHistory.length > 0){
		let undoItem = undoHistory.pop();
		undoItem.sumItem.isChecked = false;
		undoItem.cellsList.forEach(c => {
			currentLevelScore -= 10;
			c.numItem.isUsed = false;
			c.numItem.size = 1.5;
		});

		// failsafe when out of undos: restore all numbers & sums, reset current score
		if (undoHistory.length === 0){
			currentLevelScore = 0;
			baseCellsList.forEach(c => {
				c.numItem.isUsed = false;
				if (c.numItem.size < 1){
					c.numItem.size = 1;
				}
			});
			sumsList.forEach(s => {
				s.isChecked = false;
			});
		}

		displayScore = realScore + currentLevelScore;
		particles = [];
		deselect();
	}
}

function keyPressed(){
	undo();
}



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
const BOARD_CENTER = [50, 75];
const DISPLAY_SCORE_CENTER = [20, 10];
const BASE_CELLS = [];
let baseCellsList = [];

// rendering info only
/* Cell {
	x,y, isWest (pointing left), 
	centerRPos[rx,ry], points[rx, ry][3], 
	neighbors {cell, border}[], 
	numItem    null | { size, value, operator, isUsed }
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
		RED: color(220, 140, 30)
	}

	// set up sums list
	sumsList = [
		{rPos: [_(15), _(35)], rotation: -30},
		{rPos: [_(34), _(24)], rotation: -30},
		{rPos: [_(15), _(116)], rotation: 30},
		{rPos: [_(34), _(127)], rotation: 30},

		{rPos: [_(66), _(127)], rotation: -30},
		{rPos: [_(85), _(116)], rotation: -30},
		{rPos: [_(66), _(24)], rotation: 30},
		{rPos: [_(85), _(35)], rotation: 30}
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


function draw(){
    background(COLORS.BG);

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
	let sumIsMatched = sumsList.some(sumItem => {
		// not matched or already checked? skip
		if (sumItem.isChecked || sumItem.value !== currentSum){return false;}
		return true;
	});

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
	for (let i=0; i<5; i++){
		let t = frameCount*4 + 36*i;
		square(_(cos(t)*10 + 20), _(sin(t*2)*5 + 10), _(2));
	}
	text(displayScore, _(DISPLAY_SCORE_CENTER[0]), _(DISPLAY_SCORE_CENTER[1]));
	

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
			let renderY = mouseY - _(20);
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
	} else {
		//////// don't if viewing tutorial

		// update sum generation
		generateSum(numSpawnIndex);
		if (isDoneSpawning()){
			sumsList.forEach(s => console.log(s.isChecked));
		}
		
		// update spawning
		let numItem = baseCellsList[numSpawnIndex].numItem;
		numItem.size = 1.8;
		numItem.isUsed = false;
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
			playSoundEffect();
		}
	}


}

function isDoneSpawning(){
	return numSpawnIndex >= baseCellsList.length;
}

let mainFont;
function preload(){
	mainFont = loadFont('./Square.ttf');

	if (typeof loadSound !== "undefined"){
		allSounds.forEach(item => {
			item.sound = loadSound(item.src, ()=>{
				item.sound.setVolume(item.vol);
			});
		});
	}
}