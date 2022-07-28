let isPaused = true;
let isDeterministic = true;

let mainFont;
let helpImages = [];
let boxImages = [], blueGemImages = [], orangeGemImages = [];
let playerImage, aiImage;
let landingSound = {src: "assets/sounds/landing.mp3", vol:0.5};
let cardSound = {src: "assets/sounds/cardSelect.wav", vol:0.5};
let previewSound = {src: "assets/sounds/preview.wav", vol:0.6};
const allSounds = [landingSound, cardSound, previewSound];

let CARDS_LIST, CONSTANTS, cellSize, gridPoints, scene, justChangedScene;
let landingShockwave = {
	timer: -999, // plays at 0
	pos: [0,0]
};
function makeShockwave(pos){
	landingShockwave.pos = pos;
	landingShockwave.timer = CONSTANTS.DELAYS.BOX_FALL;
}

function semiRandom(start, end){
	if (isDeterministic){
		return map(Rune.deterministicRandom(), 0, 1, start, end);
	} else {
		return random(start, end);
	}
}

let PlayScene = {
	buttons: [],
	canClick: true, // false when placing box, starting game, game over
	isAgainstComputer: true,
	startingBoxesCount: 0,
	
	// computer is p1
	p1: {
		score: 0,
		brokenBoxes: 0,
		cards: [] // always contains 3 items
	},
	p2: {
		score: 0,
		brokenBoxes: 0,
		cards: [] // always contains 3 items
	},
	
	// used for both p1 and p2
	isP1Turn: true,
	actionsLeft: 0, 
	selectedCardIndex: null,
	hoveredPos: null, // null or [x,y]
	targetedPositions: null,
	
	phase: "",
	delayTimer: 0,
	remainingCards: [],
	
	board: [], // 4x4 array of item objects {itemName,fallProgress, itemImageIndex}
	slidingCards: [], // array of {isP1,index,data,progress}
	blownItems: [], // array of {itemName,timer,vel,renderPos}
	glowScore: {isP1: false, timer: 0},
	turnTextTimer: 0, // shows whose turn 
	
	AI: {
		timer: 0, nextMove: null,
		moves: [] // queued moves [{cardIndex, pos}]
	}
};

let Button = function(t, x, y, w, h, s, action){
	this.isHovered = false;
	this.action = action;
	
	this.draw = function(){
		// check hover
		if ((scene === CONSTANTS.SCENES.PLAY && PlayScene.canClick)){
			if (getMouseX() > x-w/2 && getMouseX() < x+w/2 && 
			getMouseY() > y-h/2 && getMouseY() < y+h/2 ){
				this.isHovered = true;
			}
		}
		
		// render
		fill(this.isHovered ? 
		changableColor() : CONSTANTS.COLOR_1);
		rect(x, y, w, h);
		fill(this.isHovered ? 
		CONSTANTS.COLOR_1 : changableColor());
		textSize(s);
		noStroke();
		text(t, x, y);
	};
};



function notComputerTurn(){
	return !(PlayScene.isAgainstComputer && PlayScene.isP1Turn);
}

function getRenderPos(pos){
	return [
		CONSTANTS.BOARD.POS[0] + cellSize*(pos[0] - 1.5), 
		CONSTANTS.BOARD.POS[1] + cellSize*(pos[1] - 1.5)
	];
}

// returns true if a pos is inside an array of pos's
function posIsInsideArray(pos, arr){
	return arr.some(function(insidePos){
		return insidePos[0] === pos[0] && insidePos[1] === pos[1];
	});
}

function setPlayingDelay(delayAmount){
	if (PlayScene.phase !== CONSTANTS.PHASES.PLAYING) {return;}
	PlayScene.canClick = false;
	PlayScene.delayTimer = max(PlayScene.delayTimer, delayAmount);
}
function getCurrentCardsArray(){
	return PlayScene.isP1Turn ? PlayScene.p1.cards : PlayScene.p2.cards;
}

function endGame(){
	PlayScene.phase = CONSTANTS.PHASES.OVER;
	PlayScene.canClick = false;
	PlayScene.delayTimer = CONSTANTS.DELAYS.GAMEOVER;
}

function startGame(isAgainstComputer){
	scene = CONSTANTS.SCENES.PLAY;
	PlayScene.isAgainstComputer = isAgainstComputer;
	PlayScene.canClick = false;
	PlayScene.phase = CONSTANTS.PHASES.START;
	
	PlayScene.p1.cards = [null, null, null];
	PlayScene.p1.score = 0;
	PlayScene.p1.brokenBoxes = 0;
	
	PlayScene.p2.cards = [null, null, null];
	PlayScene.p2.score = 0;
	PlayScene.p2.brokenBoxes = 0;
	
	PlayScene.delayTimer = CONSTANTS.DELAYS.DRAWING_CARDS;
	PlayScene.startingBoxesCount = CONSTANTS.STARTING_BOXES_COUNT;
	PlayScene.selectedCardIndex = null;
	PlayScene.hoveredPos = null;
	
	PlayScene.slidingCards = [];
	PlayScene.blownItems = [];
	PlayScene.glowScore = {isP1: false, timer: 0};
	PlayScene.turnTextTimer = 0;
	
	var AI = PlayScene.AI;
	AI.moves = [];
	AI.nextMove = null;
	
	PlayScene.isP1Turn = semiRandom(0,1) < 0.5;
	PlayScene.board = [];
	for (var i=0; i<4; i++){
		PlayScene.board.push([null,null,null,null].slice());
	}
	
	// shuffle the cards
	const orderedArray = [];
	CARDS_LIST.forEach(function(card){
		// add multiple copies of the same card to random index
		for (let i=0; i < card.count; i++){
			orderedArray.push(card);
		}
	});
	const shuffledArray = [];
	while (orderedArray.length > 0){
		const randomNumber = shuffledArray.length < 6? semiRandom(0,1): random(0,1);
		shuffledArray.push(
			orderedArray.splice(
				floor(randomNumber * orderedArray.length),1
			)[0]
		);
	}
	PlayScene.remainingCards = shuffledArray;
	
	// new gridPoints
	gridPoints = [];
	for (var y=0; y < 5; y++){
	    var row = [];
	    for (var x=0; x < 5; x++){
	        var renderPos = getRenderPos([x,y]);
	        row.push([
	            renderPos[0] - 0.5*cellSize + 
	            _(random() > 0.5 ? random(3,5) : -random(3,5)), 
	            renderPos[1] - 0.5*cellSize + 
	            _(random() > 0.5 ? random(3,5) : -random(3,5))
	        ]);
	    }
	    gridPoints.push(row);
	}

	// bg colors
	const bgColor1 = semiRandom(0, 360);
	const bgColor2 = semiRandom(50, 300);
	document.getElementById("overlay").style.backgroundImage = `linear-gradient(hsla(${bgColor1}, 100%, 15%, 0.6), hsla(${bgColor1+bgColor2}, 100%, 15%, 0.6))`;

	//PlayScene.remainingCards = PlayScene.remainingCards.slice(16);
}

// create and add btn card
function addBtnCard(cardsArray, targetIndex){
	if (PlayScene.remainingCards.length > 0){
		var card = PlayScene.remainingCards.shift();
		cardsArray[targetIndex] = {
			transitionProgress: 0, // 0 to 90
			card: card
		};
		if (PlayScene.phase === CONSTANTS.PHASES.PLAYING){
			setPlayingDelay(CONSTANTS.DELAYS.CARD_TRANSITION/2);
		}
	}
}

function renderCard(data, x, y, isHovered){
	if (data === null) {return;}
	var MCS = CONSTANTS.CARD_SIZE * 0.25;
	push();
	translate(x, y);
	fill(isHovered? changableColor() : CONSTANTS.COLOR_1);
	stroke(changableColor());
	rect(0,0, CONSTANTS.CARD_SIZE, CONSTANTS.CARD_SIZE);
	
	fill(isHovered? CONSTANTS.COLOR_1 : changableColor());
	stroke(isHovered? changableColor() : CONSTANTS.COLOR_1);
	data.forEach(function(row, dy){
		row.forEach(function(cell, dx){
			if (cell === 1){
				rect(
					(dx-1) * MCS, (dy-1) * MCS,
					MCS, MCS
				);
			}
		});
	});
	pop();
}

function renderBtnCard(btnCard, index, isP1){
	if (btnCard === null) {return;}
	
	var renderX = _(75) + _(100)*index; // hand x
	var renderY = isP1 ? CONSTANTS.P1_CARDS_Y : CONSTANTS.P2_CARDS_Y;
	// update transition animation
	if (btnCard.transitionProgress < 90){
		btnCard.transitionProgress += 2;
		renderX = CONSTANTS.DRAW_PILE_POS[0] - (CONSTANTS.DRAW_PILE_POS[0] - renderX) * sin(btnCard.transitionProgress);
		renderY = CONSTANTS.DRAW_PILE_POS[1] - (CONSTANTS.DRAW_PILE_POS[1] - renderY) * sin(btnCard.transitionProgress);
	}
	
	var isActive = isP1 === PlayScene.isP1Turn;
	var isSelected = isActive && PlayScene.selectedCardIndex === index;
	btnCard.isHovered = PlayScene.canClick && 
	isActive && notComputerTurn() &&
	abs(renderX - getMouseX()) <= CONSTANTS.CARD_SIZE/2 &&
	abs(renderY - getMouseY()) <= CONSTANTS.CARD_SIZE/2;
	renderCard(
		btnCard.card.data, 
		renderX, renderY, 
		// is selected or is hovered or is idle
		isSelected || btnCard.isHovered || 
		(PlayScene.selectedCardIndex === null &&
		PlayScene.canClick &&
		frameCount % 150 < 30 && isActive)
	);
}


// PHASE START after timer delay is done
function afterDelayPhaseStart(){
	// find empty slot
	var cardsArray = getCurrentCardsArray();
	var noMoreEmptySlot = true;
	for (var i=0; i < cardsArray.length; i++){
		if (cardsArray[i] === null){
			addBtnCard(cardsArray, i);
			noMoreEmptySlot = false;
			break;
		}
	}
	
	PlayScene.isP1Turn = !PlayScene.isP1Turn;
	// still drawing cards?
	if (!noMoreEmptySlot) {
		PlayScene.delayTimer = CONSTANTS.DELAYS.DRAWING_CARDS;
		// add box
		if (PlayScene.startingBoxesCount-- > 0) {spawnBoxRandom();}
	} else {
		PlayScene.phase = CONSTANTS.PHASES.PLAYING;
		setPlayingDelay(CONSTANTS.DELAYS.CARD_TRANSITION/2);
		beginTurn();
	}
}

// runs at the start of a turn
function beginTurn(){
	isDeterministic = false;
	PlayScene.selectedCardIndex = null;
	// if more than 1 card in hand then give 2 actions
	// if only 1 then give 1 action
	// if no more card to play then end game
	var amountOfCards = getCurrentCardsArray().filter(function(btnCard){
		return btnCard !== null;
	}).length;
	if (amountOfCards > 1){
		PlayScene.actionsLeft = 2;
	} else if (amountOfCards === 1) {
		PlayScene.actionsLeft = 1;
	}
	else {endGame(); return;}
	
	PlayScene.turnTextTimer = CONSTANTS.DELAYS.TURN_TEXT;
	// set up AI
	if (PlayScene.isAgainstComputer && PlayScene.isP1Turn){
		var AI = PlayScene.AI;
		AI.timer = 60; // after turn started delay
		AI.moves = [];
		AI.nextMove = null;
	}
}

// runs when used all actions
function endTurn(){
	// draw to fill the missing cards in hand
	var cardsArray = getCurrentCardsArray();
	cardsArray.forEach(function(cardBtn, i){
		if (cardBtn === null){
			addBtnCard(cardsArray, i);
		}
	});
	
	spawnBoxRandom(); // spawn a random box
	PlayScene.isP1Turn = !PlayScene.isP1Turn;
	beginTurn();
}


function getPoint(itemName){
	switch (itemName){
		case CONSTANTS.ITEM_NAMES.BLUE:
			return 2;
		case CONSTANTS.ITEM_NAMES.ORANGE:
			return -3;
		case CONSTANTS.ITEM_NAMES.BOX_BLUE:
		case CONSTANTS.ITEM_NAMES.BOX_ORANGE:
		case CONSTANTS.ITEM_NAMES.BOX_NOTHING:
			return 1;
	}
}

// returns array of {itemName, pos, point}
function getStrikePoints(_targetedPositions){
	var orangeGemsCount = 0;
	var strikedItems = _targetedPositions.map(function(pos){
		var slot = PlayScene.board[pos[1]][pos[0]];
		if (slot === null) {return null;} // empty slot
		
		var itemName = slot.itemName;
		if (itemName === CONSTANTS.ITEM_NAMES.ORANGE){
			orangeGemsCount++;
		}
		return {
			pos: pos, 
			itemName: itemName, 
			itemImageIndex: slot.itemImageIndex, 
			point: getPoint(itemName)
		};
	});
	strikedItems = strikedItems.filter(function(obj){
		return obj !== null;
	});
	
	// apply orange gem rule (+3 if multiple orange gems)
	if (orangeGemsCount > 1){ 
		strikedItems = strikedItems.map(function(obj){
			if (obj.itemName === CONSTANTS.ITEM_NAMES.ORANGE){
				obj.point = 3;
			}
			return obj;
		});
	}
	
	// apply x2
	var doesApplyDouble = false;
	if (PlayScene.isP1Turn){
	    doesApplyDouble = PlayScene.p1.brokenBoxes >= 5;
	} else {
	    doesApplyDouble = PlayScene.p2.brokenBoxes >= 5;
	}
	if (doesApplyDouble) {
	    strikedItems = strikedItems.map(function(obj){
	        obj.point *= 2;
	        return obj;
	    });
	}
	
	return strikedItems;
}

// runs when a card is played
function playSelectedCard(){
	let actualPreviewPos = notComputerTurn()?previewPos:PlayScene.hoveredPos;
	if (PlayScene.selectedCardIndex === null ||
		actualPreviewPos === null) {return;}
	var x = actualPreviewPos[0], y = actualPreviewPos[1];
	// slot not empty
	if (PlayScene.board[y][x] !== null) {return;}
	
	// SUCCESS PLAY
	var cardsArray = getCurrentCardsArray();
	
	// apply damage
	var strikedItems = getStrikePoints(PlayScene.targetedPositions);
	// count broken boxes, spawn gems, add flying items
	var brokenBoxes = 0;
	strikedItems.forEach(function(itemObj){
	    // drop gems & count box
		var pos = itemObj.pos;
		var contentName = null;
		
		// is box?
		if (itemObj.itemName === CONSTANTS.ITEM_NAMES.BOX_BLUE || itemObj.itemName === CONSTANTS.ITEM_NAMES.BOX_ORANGE || itemObj.itemName === CONSTANTS.ITEM_NAMES.BOX_NOTHING){
		    brokenBoxes++;
		} 
		
		if (itemObj.itemName === CONSTANTS.ITEM_NAMES.BOX_BLUE){
			contentName = CONSTANTS.ITEM_NAMES.BLUE;
		} else if (itemObj.itemName === CONSTANTS.ITEM_NAMES.BOX_ORANGE){
			contentName = CONSTANTS.ITEM_NAMES.ORANGE;
		}
		PlayScene.board[pos[1]][pos[0]] = contentName === null ? null :
		{
			itemName: contentName, 
			fallProgress: 0, 
			itemImageIndex: floor(random(0,3))
		};
		
		// add fake flying item
		PlayScene.blownItems.push({
			itemImageIndex: itemObj.itemImageIndex,
			itemName: itemObj.itemName,
			timer: CONSTANTS.DELAYS.BOX_FALL,
			vel: [_(random(-5,5)), _(random(-10,-15))],
			renderPos: getRenderPos(pos)
		});
	});
	
	spawnBox([x,y]); // add box (also check if board fills)
	makeShockwave([x,y]);

	// add sliding card
	PlayScene.slidingCards.push({
		isP1: PlayScene.isP1Turn,
		index: PlayScene.selectedCardIndex,
		data: cardsArray[PlayScene.selectedCardIndex].card.data,
		progress: CONSTANTS.DELAYS.SLIDE_CARD
	});

	// remove played card, consume action, reset
	cardsArray[PlayScene.selectedCardIndex] = null;
	PlayScene.actionsLeft--;
	PlayScene.selectedCardIndex = null;
	PlayScene.targetedPositions = null;
	previewPos = null;
	
	// score & broken boxes
	PlayScene.glowScore.isP1 = PlayScene.isP1Turn;
	PlayScene.glowScore.timer = CONSTANTS.DELAYS.GLOW_SCORE;
	var totalPoints = strikedItems.reduce(function(p,obj){
		return p + obj.point;
	},0);
	if (PlayScene.isP1Turn){
		PlayScene.p1.score += totalPoints;
		// if currently doubled
		if (PlayScene.p1.brokenBoxes >= 5){
		    PlayScene.p1.brokenBoxes = 0;
		} else {
		    PlayScene.p1.brokenBoxes += brokenBoxes;
		}
	} else {
	    PlayScene.p2.score += totalPoints;
	    // if currently doubled
		if (PlayScene.p2.brokenBoxes >= 5){
		    PlayScene.p2.brokenBoxes = 0;
		} else {
		    PlayScene.p2.brokenBoxes += brokenBoxes;
		}
	}
}


function spawnBoxRandom(){
	var emptySlotPositions = PlayScene.board.map(function(row, y){
		return row.map(function(item, x){
			if (item === null){ // slot is empty?
				return [x,y];
			} else {return null;}
		});
	});
	emptySlotPositions = emptySlotPositions.flat()
	.filter(function(pos){return pos;});
	if (emptySlotPositions.length > 0){
		spawnBox(emptySlotPositions[
			floor(semiRandom(0,1)*emptySlotPositions.length)
		]);
	} else { endGame(); return;}
}

function spawnBox(pos){
	var x = pos[0], y = pos[1];
	var boxName = [
		CONSTANTS.ITEM_NAMES.BOX_BLUE,
		CONSTANTS.ITEM_NAMES.BOX_BLUE,
		CONSTANTS.ITEM_NAMES.BOX_ORANGE,
		CONSTANTS.ITEM_NAMES.BOX_NOTHING
	][floor(random()*4)];
	if (PlayScene.board[y][x] === null) {
		
		PlayScene.board[y][x] = {
			itemName: boxName,
			fallProgress: CONSTANTS.DELAYS.BOX_FALL,
			itemImageIndex: floor(semiRandom(0,3))
		};
		setPlayingDelay(CONSTANTS.DELAYS.BOX_FALL);
		
		// check if board is filled then game over
		if (PlayScene.board.every(function(row){
			return row.every(function(item){return item !== null;});
		})){ endGame(); }
		
	} else {println("can't spawn box here!");}
}

// returns array of positions that are being striked
function getTargetedPositions(card, centerPos){
	var resultArr = [];
	
	if (card.special){
		switch (card.special){
			case "H":
				for (var _x=0; _x<4; _x++){
					if (_x === centerPos[0]) {continue;}
					resultArr.push([_x, centerPos[1]]);
				}
				break;
			case "V":
				for (var _y=0; _y<4; _y++){
					if (_y === centerPos[1]) {continue;}
					resultArr.push([centerPos[0], _y]);
				}
				break;
			case "I":
				for (var _x=0; _x<4; _x++){
					if (_x === centerPos[0]) {continue;}
					var _y = centerPos[1] + centerPos[0] - _x;
					if (_y >= 0 && _y < 4){
						resultArr.push([_x, _y]);
					}
				}
				break;
			case "D":
				for (var _x=0; _x<4; _x++){
					if (_x === centerPos[0]) {continue;}
					var _y = centerPos[1] - centerPos[0] + _x;
					if (_y >= 0 && _y < 4){
						resultArr.push([_x, _y]);
					}
				}
				break;
		}
	} 
	else { // non-special card
		// add to result array if qualifies
		card.data.forEach(function(row, y){
			row.forEach(function(cell, x){
				
				if (cell === 1){
					var resultPos = [
						x + centerPos[0]-1 , y + centerPos[1]-1
					];
					// if inside board
					if (resultPos[0] >= 0 && resultPos[0] < 4 &&
					resultPos[1] >= 0 && resultPos[1] < 4){
						resultArr.push(resultPos);
					}
				}
			});
		});
	}
	return resultArr;
}

function getImg(item){
	if (item.itemName === CONSTANTS.ITEM_NAMES.BLUE){
		return blueGemImages[item.itemImageIndex];
	} else if (item.itemName === CONSTANTS.ITEM_NAMES.ORANGE){
		return orangeGemImages[item.itemImageIndex];
	} 
	else { // box
		return boxImages[item.itemImageIndex];
	}
}

function renderSlotBorder(x, y){
    quad(
        gridPoints[y][x][0],
        gridPoints[y][x][1],
        gridPoints[y][x+1][0],
        gridPoints[y][x+1][1],
        gridPoints[y+1][x+1][0],
        gridPoints[y+1][x+1][1],
        gridPoints[y+1][x][0],
        gridPoints[y+1][x][1]
    );
}

function renderSlot(item,rx,ry,s){
	if (item){ // not empty?
		// update fallProgress
		if (item.fallProgress && item.fallProgress > 0)
		{item.fallProgress--;}
	
		var itemImg = getImg(item);
		var imgSize = s - max(item.fallProgress-10, 0)*_(5);
		
		image(
			itemImg, 
			rx, ry - item.fallProgress*_(3), 
			imgSize, imgSize
		);
	}
}


// returns a random highest point move
function calculateSingleMove(){
	var highestPointMoves = [];
	var currentHighPoint = 0;
	// go through all cards
	PlayScene.p1.cards.forEach(function(btnCard, cardIndex){
		if (btnCard === null) {return;} // empty card 
		PlayScene.board.forEach(function(row, y){
			row.forEach(function(slot, x){
				// exits if not empty slot
				if (slot !== null) {return;}
				
				var strikedItems = getStrikePoints(getTargetedPositions(
					btnCard.card, [x,y]
				));
				var totalPoints = strikedItems.reduce(function(p,obj){
					return p + obj.point;
				},0);
				
				// new high point
				if (totalPoints > currentHighPoint){
					currentHighPoint = totalPoints;
					highestPointMoves = [];
				}
				// add if enough points
				if (totalPoints === currentHighPoint){
					highestPointMoves.push({
						cardIndex: cardIndex,
						pos: [x,y]
					});
				}
			});
		});
	});
	
	return highestPointMoves[floor(random()*highestPointMoves.length)];
}

// runs during computer turn
function updateAI(){
	// exit conditions
	if (!PlayScene.isAgainstComputer || !PlayScene.isP1Turn){return;}
	if (PlayScene.phase !== CONSTANTS.PHASES.PLAYING){return;}
	if (!PlayScene.canClick || PlayScene.delayTimer > 0){return;}
	
	var AI = PlayScene.AI;
	if (AI.nextMove !== null){ // keep the hover effect
		PlayScene.hoveredPos = AI.nextMove.pos;
	}
	if (AI.timer-- < 0){ // no longer waiting?
		// already selected a move? execute
		if (PlayScene.selectedCardIndex !== null && 
		PlayScene.hoveredPos !== null){
			AI.nextMove = null;
			PlayScene.targetedPositions = getTargetedPositions(
				getCurrentCardsArray()[PlayScene.selectedCardIndex].card,
				PlayScene.hoveredPos
			);
			playSelectedCard();
			AI.nextMove = null;
		}
		
		// not selected, but having moves in queue? set up next move
		else if (AI.moves.length > 0){
			AI.nextMove = AI.moves.shift();
			AI.timer = 90; // showing move delay
			PlayScene.selectedCardIndex = AI.nextMove.cardIndex;
			playSound(cardSound);
		}
		
		// not calculated yet?
		else {AI.moves = [calculateSingleMove()];}
	}
}

let previewPos = null;
let touchCountDown = 0;

function touchEnded(){
	if (touchCountDown > 0) return;
	else touchCountDown = 10;
	
	if (!CONSTANTS) return;

	// HELP scene click
	if (scene === CONSTANTS.SCENES.HELP && !justChangedScene){
		scene = CONSTANTS.SCENES.PLAY;
	}
	// check clicking a button in PLAY
	else if (PlayScene.canClick){
		PlayScene.buttons.forEach(function(btn){
			if (btn.isHovered) {btn.action();return;}
		});
	}
	
	// PLAY scene (not computer turn?)
	if (scene === CONSTANTS.SCENES.PLAY && 
	PlayScene.canClick &&
	PlayScene.actionsLeft > 0 &&
	notComputerTurn()){
		// clicking a card?
		var cardsArray = getCurrentCardsArray();
		for (var i=0; i<cardsArray.length; i++){
			var btnCard = cardsArray[i];
			if (btnCard && btnCard.isHovered){
				PlayScene.selectedCardIndex = i;
				previewPos = null;
				playSound(cardSound);
				return;
			}
		}

		// clear preview
		if (PlayScene.hoveredPos === null) previewPos = null;
		
		// clicking a spot?
		if (PlayScene.selectedCardIndex !== null && 
		PlayScene.hoveredPos !== null){
			// set preview if none
			if (!previewPos){
				previewPos = PlayScene.hoveredPos;
				playSound(previewSound);
			} else {
				// match preview?
				if (PlayScene.hoveredPos[0] === previewPos[0] &&
					PlayScene.hoveredPos[1] === previewPos[1]){
						playSelectedCard();	
				} else {
					previewPos = PlayScene.hoveredPos;
					playSound(previewSound);
				}
			}
		}
	}
}



function playSound(soundItem){
	if (soundItem.sound && !soundItem.sound.isPlaying()) soundItem.sound.play();
}

function preload(){
	mainFont = loadFont('assets/Minecraft.ttf');
	playerImage = loadImage("assets/items/player.png");
	aiImage = loadImage("assets/items/ai.png");

	for (let i=0; i < 3; i++){
		boxImages.push(loadImage(`assets/items/box${i+1}.png`));
		blueGemImages.push(loadImage(`assets/items/coins${i+1}.png`));
		orangeGemImages.push(loadImage(`assets/items/gem${i+1}.png`));
		helpImages.push(loadImage(`assets/help/help${i+1}.jpg`));
	}

	if (typeof loadSound !== "undefined"){
		allSounds.forEach(item => {
			item.sound = loadSound(item.src, ()=>{
				item.sound.setVolume(item.vol);
			});
		});
	}

}

let CANVAS_WIDTH, HEIGHT_RATIO;

function setup() {
	HEIGHT_RATIO = 1.5;
	CANVAS_WIDTH = min(
		document.documentElement.clientWidth,
		document.documentElement.clientHeight/HEIGHT_RATIO
	);
	createCanvas(
		document.documentElement.clientWidth,
		document.documentElement.clientHeight
	).parent("overlay");

	CONSTANTS = {
		SCENES: {WELCOME:"WELCOME",MENU:"MENU",PLAY:"PLAY",HELP:"HELP"},
		COLOR_1: 30, // BLACK
		COLOR_2: 230, // WHITE
		COLOR_3: color(0, 250, 0), //GREEN
		COLOR_4: color(250, 0, 0), //RED
		COLOR_5: color(250, 250, 0), // YELLOW
		CREATURES_LIST: [],
		PLAYGROUND: {SIZE: 400, POS: [215, 260]},
		
		PVP: {P1: "Player1", P2: "Player2"},
		PVE: {P1: "AI", P2: "Player"},
		PHASES: {
			START:"START",PLAYING:"PLAYING",OVER:"OVER"
		},
		CARD_SIZE: _(65),
		DRAW_PILE_POS: [_(600), _(300)],
		BOARD: {SIZE: _(420), POS: [_(230), _(300)]},
		P1_CARDS_Y: _(42),
		P2_CARDS_Y: _(570),
		STARTING_BOXES_COUNT: 5,
		
		DELAYS: {
			DRAWING_CARDS: 20, CARD_TRANSITION: 90,
			BOX_FALL: 30, GLOW_SCORE: 50, SLIDE_CARD: 20,
			TURN_TEXT: 60, GAMEOVER: 200
		},
		ITEM_NAMES: {
			BOX_BLUE:"BOX_BLUE", BOX_ORANGE:"BOX_ORANGE", 
			BOX_NOTHING:"BOX_NOTHING", BLUE:"BLUE", ORANGE:"ORANGE"
		}
	};

	CARDS_LIST = [
		{count: 1, data: [
			[0,1,1],
			[0,0,1],
			[1,0,0]
		]},
		{count: 1, data: [
			[1,1,0],
			[1,0,0],
			[0,0,1]
		]},
		{count: 1, data: [
			[1,0,0],
			[0,0,1],
			[0,1,1]
		]},
		{count: 1, data: [
			[0,0,1],
			[1,0,0],
			[1,1,0]
		]},
		
		{count: 1, data: [
			[0,0,1],
			[1,0,1],
			[0,0,1]
		]},
		{count: 1, data: [
			[1,1,1],
			[0,0,0],
			[0,1,0]
		]},
		{count: 1, data: [
			[1,0,0],
			[1,0,1],
			[1,0,0]
		]},
		{count: 1, data: [
			[0,1,0],
			[0,0,0],
			[1,1,1]
		]},
		
		{count: 3, data: [
			[0,1,0],
			[1,0,1],
			[0,1,0]
		]},
		{count: 3, data: [
			[1,0,1],
			[0,0,0],
			[1,0,1]
		]},
		
		
		{special: "H", count: 2, data: [
			[0,0,0],
			[1,1,1],
			[0,0,0]
		]},
		{special: "V", count: 2, data: [
			[0,1,0],
			[0,1,0],
			[0,1,0]
		]},
		{special: "D", count: 2, data: [
			[1,0,0],
			[0,1,0],
			[0,0,1]
		]},
		{special: "I", count: 2, data: [
			[0,0,1],
			[0,1,0],
			[1,0,0]
		]}
	];

	cellSize = CONSTANTS.BOARD.SIZE/4;
	gridPoints = []; // 5x5 random points for grid rendering
	
	scene = CONSTANTS.SCENES.WELCOME;
	justChangedScene = true; // fix click to go back quirk
  
  	rectMode(CENTER);
	imageMode(CENTER);
	textAlign(CENTER, CENTER);
	angleMode(DEGREES);
	textFont(mainFont);
	noSmooth();
	strokeJoin(ROUND);

	// help button
	PlayScene.buttons.push(new Button(
		"?",
		_(390), _(650), _(60), _(40), _(30),
		function(){
			scene = CONSTANTS.SCENES.HELP;
			justChangedScene = true;
		}
	));

	Rune.init({
		resumeGame: function () {
			isPaused = false;
		},
		pauseGame: function () {
			isPaused = true;
		},
		restartGame: function () {
			isDeterministic = true;
			startGame(true);
		},
		getScore: function () {
			let fs = PlayScene.p2.score;
			// x10
			if (PlayScene.phase === CONSTANTS.PHASES.OVER &&
			fs > PlayScene.p1.score) { fs *= 10; }
			return max(fs, 0);
		}
	});

	startGame(true);
}

function changableColor(){
	return CONSTANTS.COLOR_2;
}

function getMouseX(){
	return mouseX - (width/2-CANVAS_WIDTH/2);
}
function getMouseY(){
	return mouseY - (height/2-CANVAS_WIDTH*HEIGHT_RATIO/2);
}
function draw() {
	touchCountDown--;
	if (isPaused && frameCount !== 1) return;
	translate(width/2-CANVAS_WIDTH/2, height/2-CANVAS_WIDTH*HEIGHT_RATIO/2);
	justChangedScene = false;
  	clear();
	
	if (scene === CONSTANTS.SCENES.PLAY){
		// reset
		PlayScene.hoveredPos = null; 
		PlayScene.targetedPositions = null;
		
		updateAI(); // AI

		// render shockwave
		landingShockwave.timer--;
		if (landingShockwave.timer <= 0 && landingShockwave.timer > -30){
			if (landingShockwave.timer === 0){
				playSound(landingSound);
			}
			let renderPos = getRenderPos(landingShockwave.pos);
			let s = map(landingShockwave.timer, 0, -30, 0, 1);
			noStroke();
			fill(255, 255 - (s*255));
			ellipse(renderPos[0], renderPos[1] + _(30), _(200*s), _(30*s));
		}
		
		var checkHoverMarginFactor = 0.9;
		// board
		stroke(CONSTANTS.COLOR_2); strokeWeight(_(2)); noFill();
		for (var y=0; y<4; y++){
			for (var x=0; x<4; x++){
				var renderPos = getRenderPos([x,y]);
				var rx = renderPos[0], ry = renderPos[1];
				// check to set hoveredPos
				if (notComputerTurn() && PlayScene.hoveredPos === null &&
				PlayScene.board[y][x] === null &&
				abs(rx-getMouseX()) < cellSize/2*checkHoverMarginFactor &&
				abs(ry-getMouseY()) < cellSize/2*checkHoverMarginFactor){
					PlayScene.hoveredPos = [x, y];
				}
				renderSlotBorder(x, y);
				renderSlot(PlayScene.board[y][x],rx,ry,cellSize);
			}
		}

		let actualPreviewPos = notComputerTurn()?previewPos:PlayScene.hoveredPos;
		
		if (actualPreviewPos !== null &&
		PlayScene.selectedCardIndex !== null){
			PlayScene.targetedPositions = getTargetedPositions(
				getCurrentCardsArray()[PlayScene.selectedCardIndex].card,
				actualPreviewPos
			);
		}
		
		// renders buttons 
		stroke(changableColor()); strokeWeight(_(3));
		PlayScene.buttons.forEach(function(btn){
			btn.isHovered = false; // reset
			btn.draw();
		});
		
		// render scores
		noStroke();
		fill(changableColor());
		textSize(_(40));
		text("-", _(180), _(650));
		var playerNames = CONSTANTS.PVE;
		if (PlayScene.glowScore.timer > 0) {PlayScene.glowScore.timer--;}
		if (PlayScene.glowScore.isP1 && PlayScene.glowScore.timer > 0){
			fill(CONSTANTS.COLOR_3);
		} else {fill(changableColor());}
		text(PlayScene.p1.score, _(220), _(650));
		image(playerImage, _(80), _(650), _(60), _(60));
		
		if (!PlayScene.glowScore.isP1 && PlayScene.glowScore.timer > 0){
			fill(CONSTANTS.COLOR_3);
		} else {fill(changableColor());}
		text(PlayScene.p2.score, _(140), _(650));
		image(aiImage, _(280), _(650), _(60), _(60));
		
		// player double status
		textSize(_(30));
		noStroke();

		// P1
		if (PlayScene.p1.brokenBoxes >= 5){
			fill(CONSTANTS.COLOR_5);
		} else {
			fill(changableColor());
		}
		push();
		translate(_(390), CONSTANTS.P1_CARDS_Y);
		text("X2", 0, 0);
		rotate(-144);
		for (let i=0; i<5; i++){
			if (PlayScene.p1.brokenBoxes <= i) break;
			rect(0, _(30), _(30), _(5));
			rotate(72);
		}
		pop();

        // P2
        if (PlayScene.p2.brokenBoxes >= 5){
			fill(CONSTANTS.COLOR_5);
		} else {
			fill(changableColor());
		}
		push();
		translate(_(390), CONSTANTS.P2_CARDS_Y);
		text("X2", 0, 0);
		rotate(-144);
		for (let i=0; i<5; i++){
			if (PlayScene.p2.brokenBoxes <= i) break;
			rect(0, _(30), _(30), _(5));
			rotate(72);
		}
		pop();
        
		
		// renders fake cards sliding down (remove when done)
		strokeWeight(_(3));
		PlayScene.slidingCards = PlayScene.slidingCards
		.filter(function(slideCard){
			var renderX = _(75) + _(100) * slideCard.index;
			var renderY;
			var offsetY = (CONSTANTS.DELAYS.SLIDE_CARD - slideCard.progress)*_(10);
			if (slideCard.isP1){
				renderY = CONSTANTS.P1_CARDS_Y - offsetY;
			} else {
				renderY = CONSTANTS.P2_CARDS_Y + offsetY;
			}
			renderCard(slideCard.data, renderX, renderY, true);
			slideCard.progress--;
			return slideCard.progress > 0;
		});
		
		// renders p1 cards
		PlayScene.p1.cards.forEach(function(btnCard, index){
			renderBtnCard(btnCard, index, true);
		});
		// renders p2 cards
		PlayScene.p2.cards.forEach(function(btnCard, index){
			renderBtnCard(btnCard, index, false);
		});
		
		// renders flying items (remove if out of screen)
		PlayScene.blownItems = PlayScene.blownItems.filter(function(item){
			// move after timer is done only
			if (item.timer-- < 0){
				item.renderPos[0] += item.vel[0];
				item.renderPos[1] += item.vel[1];
				item.vel[1] += _(0.7); // gravity
			}
			var itemImg = getImg(item);
			var imgSize = cellSize;
			image(
				itemImg, 
				item.renderPos[0], item.renderPos[1], 
				imgSize, imgSize
			);
			return item.renderPos[1] < _(800);
		});
		
		// renders targeted slot borders and score
		if (PlayScene.targetedPositions !== null){
			// renders borders
			strokeWeight(_(5)); 
			stroke(CONSTANTS.COLOR_5); 
			noFill();
			PlayScene.targetedPositions.forEach(function(pos){
				renderSlotBorder(pos[0], pos[1]);
			});
			
			// renders points
			var strikedItems = getStrikePoints(PlayScene.targetedPositions);
			noStroke();
			strikedItems.forEach(function(obj){
				var renderPos = getRenderPos(obj.pos);
				// renders overlay bg
				fill(0,0,0,180);
				rect(renderPos[0],renderPos[1],
				cellSize*0.5,cellSize*0.5, _(5));
				if (obj.point > 0) {fill(CONSTANTS.COLOR_3);}
				else {fill(CONSTANTS.COLOR_4);}
				textSize(_(30));
				var slotPoint = (obj.point > 0 ? "+":"") + obj.point;
				noStroke();
				text(slotPoint, renderPos[0],renderPos[1]);
			});
			
			// renders center
			var cRenderPos = getRenderPos(actualPreviewPos);
			var totalPoints = strikedItems.reduce(function(p,obj){
				return p + obj.point;
			},0);
			fill(CONSTANTS.COLOR_5); textSize(_(60));
			noStroke();
			if (totalPoints > 0) {totalPoints = "+"+totalPoints;}
			// apply shaking if is doubled
				if ((PlayScene.p1.brokenBoxes >= 5 && PlayScene.isP1Turn) || (PlayScene.p2.brokenBoxes >= 5 && !PlayScene.isP1Turn)){
				text(totalPoints, 
					cRenderPos[0] + _(random(-2, 2)), 
					cRenderPos[1] + _(random(-2, 2)));
			}
			else {
			    text(totalPoints, cRenderPos[0],cRenderPos[1]);
			}
		}
		
		// whose turn/gameover text
		var displayText;
		if (PlayScene.phase === CONSTANTS.PHASES.OVER){
			if (PlayScene.p1.score === PlayScene.p2.score){
				displayText = "Draw!";
			} else if (PlayScene.p1.score < PlayScene.p2.score){
				displayText = playerNames.P2 + " wins!";
			} else {
				displayText = playerNames.P1 + " wins!";
			}
		} else if (PlayScene.turnTextTimer-- > 0){
			displayText = (PlayScene.isP1Turn?playerNames.P1:
			playerNames.P2) + " turn";
		}
			
		if (displayText){
			fill(0,0,0,200);
			noStroke();
			rect(CONSTANTS.BOARD.POS[0], CONSTANTS.BOARD.POS[1], 
			_(300), _(70), _(10));
			fill(CONSTANTS.COLOR_5);
			textSize(_(35));
			noStroke();
			text(displayText, 
			CONSTANTS.BOARD.POS[0], CONSTANTS.BOARD.POS[1]);
		}
		
		// update delay timer
		if (PlayScene.delayTimer > 0){
			PlayScene.delayTimer--;
			if (PlayScene.delayTimer <= 0){ // finish delay
				// phase START?
				if (PlayScene.phase === CONSTANTS.PHASES.START){
					afterDelayPhaseStart();
				}
				// phase PLAYING
				else if (PlayScene.phase === CONSTANTS.PHASES.PLAYING){
					PlayScene.canClick = true;
					if (PlayScene.actionsLeft <= 0){endTurn();}
				}
				// phase OVER
				else if (PlayScene.phase === CONSTANTS.PHASES.OVER){
					Rune.gameOver();
				}
			}
		}
	}
	else if (scene === CONSTANTS.SCENES.HELP){
		textSize(_(30));
		fill(changableColor());
		
		image(helpImages[0], _(80), _(70), _(150), _(130));
		image(helpImages[1], _(235), _(70), _(140), _(130));
		image(helpImages[2], _(385), _(70), _(140), _(130));
		text("Play 2 cards per turn", _(230), _(160));

		image(boxImages[1],_(100), _(230), _(100), _(100));
		image(boxImages[2],_(110), _(240), _(100), _(100));
		image(boxImages[0],_(120), _(250), _(100), _(100));
		text("x5    =>", _(230), _(240));

		push();
		translate(_(350), _(240));
		noStroke();
		fill(CONSTANTS.COLOR_5);
		text("X2", 0, 0);
		rotate(-144);
		for (let i=0; i<5; i++){
			rect(0, _(30), _(30), _(5));
			rotate(72);
		}
		pop();

		push();
		strokeWeight(6);
		stroke(changableColor());
		line(_(100),_(300),_(100),_(350));
		line(_(250),_(325),_(250),_(350));
		line(_(400),_(325),_(400),_(350));
		line(_(100),_(325),_(400),_(325));
		pop();

		text("50%", _(100), _(380));
		text("25%", _(250), _(380));
		text("25%", _(400), _(380));

		push();
		translate(_(240), _(460));
		rotate(-90);
		text("such\nempty", 0,0);
		pop();

		image(orangeGemImages[1],_(400), _(430), _(100), _(100));
		image(orangeGemImages[0],_(425), _(470), _(100), _(100));
		image(orangeGemImages[2],_(375), _(470), _(100), _(100));
		image(blueGemImages[2],_(100), _(450), _(100), _(100));

		fill(CONSTANTS.COLOR_3);
		text("+2", _(100), _(510));
		text("+3", _(390), _(510));
		text("+1", _(50), _(300));

		fill(changableColor());
		text("You should hit 2 or more\nblue gems at once!\nX10 score when won!",
		_(230), _(600));

	}

}

function _(num) {
  return CANVAS_WIDTH / 460 * num;
}