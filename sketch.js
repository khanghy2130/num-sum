let isPaused = true;
let mainFont;
let boxImage, blueGemImage, orangeGemImage;

let CARDS_LIST, CONSTANTS, cellSize, gridPoints, scene, justChangedScene;


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
	
	board: [], // 4x4 array of item objects {itemName,fallProgress}
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
		if ((scene === CONSTANTS.SCENES.MENU && MenuScene.canClick) || 
		(scene === CONSTANTS.SCENES.PLAY && PlayScene.canClick)){
			if (mouseX > x-w/2 && mouseX < x+w/2 && 
			mouseY > y-h/2 && mouseY < y+h/2 ){
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
PlayScene.buttons.push(new Button(
	"?",
	525, 120, 50, 50, 30,
	function(){
		scene = CONSTANTS.SCENES.HELP;
		justChangedScene = true;
	}
));




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
	// add xp
	var earnedXP = PlayScene.isAgainstComputer ?
	PlayScene.p2.score :
	max(PlayScene.p1.score,PlayScene.p2.score);
	// win against computer? double score
	if (PlayScene.isAgainstComputer && 
	PlayScene.p2.score > PlayScene.p1.score){
		earnedXP *= 2;
	}
	MenuScene.earnedXP += earnedXP;
	
	// set highscore & wins count
	if (PlayScene.isAgainstComputer){
		if (PlayScene.p2.score > PlayScene.p1.score){
			MenuScene.winsCount++;
		}
		if (PlayScene.p2.score > MenuScene.highScore){
			MenuScene.highScore = PlayScene.p2.score;
		}
	}
	
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
	
	PlayScene.isP1Turn = random() < 0.5;
	PlayScene.board = [];
	for (var i=0; i<4; i++){
		PlayScene.board.push([null,null,null,null].slice());
	}
	
	// shuffle the cards
	PlayScene.remainingCards = [];
	CARDS_LIST.forEach(function(card){
		// add multiple copies of the same card to random index
		for (var i=0; i < card.count; i++){
			PlayScene.remainingCards.splice(
				floor(random() * PlayScene.remainingCards.length),
				0, card
			);
		}
	});
	
	// new gridPoints
	gridPoints = [];
	for (var y=0; y < 5; y++){
	    var row = [];
	    for (var x=0; x < 5; x++){
	        var renderPos = getRenderPos([x,y], cellSize);
	        row.push([
	            renderPos[0] - 0.5*cellSize + 
	            (random() > 0.5 ? random(5,9) : -random(2,3)), 
	            renderPos[1] - 0.5*cellSize + 
	            (random() > 0.5 ? random(5,9) : -random(2,3))
	        ]);
	    }
	    gridPoints.push(row);
	}
	
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
	abs(renderX - mouseX) <= CONSTANTS.CARD_SIZE/2 &&
	abs(renderY - mouseY) <= CONSTANTS.CARD_SIZE/2;
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
		return {pos: pos, itemName: itemName, point: getPoint(itemName)};
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
	if (PlayScene.selectedCardIndex === null ||
	PlayScene.hoveredPos === null) {return;}
	var x = PlayScene.hoveredPos[0], y = PlayScene.hoveredPos[1];
	// slot not empty
	if (PlayScene.board[y][x] !== null) {return;}
	
	// SUCCESS PLAY
	var cardsArray = getCurrentCardsArray();
	var playedCard = getCurrentCardsArray()[PlayScene.selectedCardIndex];
	
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
		{itemName: contentName, fallProgress: 0};
		
		// add fake flying item
		PlayScene.blownItems.push({
			itemName: itemObj.itemName,
			timer: CONSTANTS.DELAYS.BOX_FALL,
			vel: [random(-5,5), random(-10,-15)],
			renderPos: getRenderPos(pos)
		});
	});
	
	spawnBox([x,y]); // add box (also check if board fills)
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
			floor(random()*emptySlotPositions.length)
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
			fallProgress: CONSTANTS.DELAYS.BOX_FALL
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

function getImg(itemName){
	if (itemName === CONSTANTS.ITEM_NAMES.BLUE){
		return blueGemImage;
	} else if (itemName === CONSTANTS.ITEM_NAMES.ORANGE){
		return orangeGemImage;
	} 
	else { // box
		return boxImage;
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
	
		var itemImg = getImg(item.itemName);
		var imgSize = s - max(item.fallProgress - 15, 0)*5;
		
		image(
			itemImg, 
			rx, ry - item.fallProgress*3, 
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
		}
		
		// not calculated yet?
		else {AI.moves = [calculateSingleMove()];}
	}
}


function mouseReleased(){
	var currentSceneObject;
	if (scene === CONSTANTS.SCENES.MENU){
		currentSceneObject = MenuScene;
	}
	else if (scene === CONSTANTS.SCENES.PLAY){
		currentSceneObject = PlayScene;
	}
	
	// check clicking a button in MENU & PLAY
	if (currentSceneObject && currentSceneObject.canClick){
		currentSceneObject.buttons.forEach(function(btn){
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
				return;
			}
		}
		
		// clicking a spot?
		if (PlayScene.selectedCardIndex !== null && 
		PlayScene.hoveredPos !== null){
			playSelectedCard();
		}
	}
	
	// HELP scene click
	if (scene === CONSTANTS.SCENES.HELP && !justChangedScene){
		scene = CONSTANTS.SCENES.PLAY;
	}
}

function preload(){
	mainFont = loadFont('assets/Minecraft.ttf');
	boxImage = loadImage('assets/box.png');
	blueGemImage = loadImage('assets/blueGem.png');
	orangeGemImage = loadImage('assets/orangeGem.png');
}

function setup() {
	const HEIGHT_RATIO = 1.5;
	const CANVAS_WIDTH = min(
		document.documentElement.clientWidth,
		document.documentElement.clientHeight/HEIGHT_RATIO
	);
	createCanvas(
		// 0.99 fix overflow
		CANVAS_WIDTH * 0.99,
		CANVAS_WIDTH * HEIGHT_RATIO * 0.99
	);

	CONSTANTS = {
		SCENES: {WELCOME:"WELCOME",MENU:"MENU",PLAY:"PLAY",HELP:"HELP"},
		COLOR_1: 30, // BLACK
		COLOR_2: 230, // WHITE
		COLOR_3: "green", //GREEN
		COLOR_4: "red", //RED
		COLOR_5: "yellow", // YELLOW
		CREATURES_LIST: [],
		PLAYGROUND: {SIZE: 400, POS: [215, 260]},
		
		PVP: {P1: "Player1", P2: "Player2"},
		PVE: {P1: "AI", P2: "Player"},
		PHASES: {
			START:"START",PLAYING:"PLAYING",OVER:"OVER"
		},
		CARD_SIZE: _(65),
		DRAW_PILE_POS: [_(525), _(250)],
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


  Rune.init({
    resumeGame: function () {
		isPaused = false;
		ee = Rune.deterministicRandom();
    },
    pauseGame: function () {
		isPaused = true;
    },
    restartGame: function () {
		///// reset game
    },
    getScore: function () {
      return 10;
    }
  });


//   setTimeout(function () {
//     Rune.gameOver(); // only call if not paused, check if paused or resumed
//   }, 5000);

	startGame(true);
}

function changableColor(){
	return CONSTANTS.COLOR_2;
}

function draw() {
	justChangedScene = false;
  	clear();
	//////
	background(0);
	
	if (scene === CONSTANTS.SCENES.PLAY){
		// reset
		PlayScene.hoveredPos = null; 
		PlayScene.targetedPositions = null;
		
		updateAI(); // AI
		
		var checkHoverMarginFactor = 0.9;
		// board grid
		stroke(CONSTANTS.COLOR_2); strokeWeight(2); noFill();
		for (var y=0; y<4; y++){
			for (var x=0; x<4; x++){
				var renderPos = getRenderPos([x,y], cellSize);
				var rx = renderPos[0], ry = renderPos[1];
				// check to set hoveredPos
				if (notComputerTurn() && PlayScene.hoveredPos === null &&
				PlayScene.board[y][x] === null &&
				abs(rx-mouseX) < cellSize/2*checkHoverMarginFactor &&
				abs(ry-mouseY) < cellSize/2*checkHoverMarginFactor){
					PlayScene.hoveredPos = [x, y];
				}
				renderSlotBorder(x, y);
				renderSlot(PlayScene.board[y][x],rx,ry,cellSize);
			}
		}
		
		if (PlayScene.hoveredPos !== null &&
		PlayScene.selectedCardIndex !== null){
			PlayScene.targetedPositions = getTargetedPositions(
				getCurrentCardsArray()[PlayScene.selectedCardIndex].card,
				PlayScene.hoveredPos
			);
		}
		
		// renders buttons 
		stroke(changableColor()); strokeWeight(3);
		PlayScene.buttons.forEach(function(btn){
			btn.isHovered = false; // reset
			btn.draw();
		});
		
		// renders draw pile
		strokeWeight(3);
		var nextCard = PlayScene.remainingCards[0]? PlayScene.remainingCards[0].data : null;
		if (nextCard){
			renderCard(
				nextCard,
				CONSTANTS.DRAW_PILE_POS[0], CONSTANTS.DRAW_PILE_POS[1], 
				false
			);
			fill(changableColor());
			textSize(25);
			noStroke();
			text(PlayScene.remainingCards.length, 525, 300);
		}
		
		// renders scores
		noStroke();
		var playerNames = PlayScene.isAgainstComputer?CONSTANTS.PVE:
		CONSTANTS.PVP;
		if (PlayScene.glowScore.timer > 0) {PlayScene.glowScore.timer--;}
		if (PlayScene.glowScore.isP1 && PlayScene.glowScore.timer > 0){
			fill(CONSTANTS.COLOR_3);
		} else {fill(changableColor());}
		textSize(22);
		text(playerNames.P1, 525, 390);
		textSize(40);
		text(PlayScene.p1.score, 525, 430);
		
		if (!PlayScene.glowScore.isP1 && PlayScene.glowScore.timer > 0){
			fill(CONSTANTS.COLOR_3);
		} else {fill(changableColor());}
		textSize(22);
		text(playerNames.P2, 525, 490);
		textSize(40);
		text(PlayScene.p2.score, 525, 530);
		
		// player double status
		textSize(18);
		stroke(changableColor());
		noFill();
		
		// P1
        for (var i=0; i < 5; i++){
            if (PlayScene.p1.brokenBoxes > i){
                strokeWeight(7);
            } else {
                strokeWeight(1);
            }
            arc(390, CONSTANTS.P1_CARDS_Y, 50, 50, i*72 + 15 - 90, (i+1)*72 - 15 - 90);
        }
        // P2
        for (var i=0; i < 5; i++){
            if (PlayScene.p2.brokenBoxes > i){
                strokeWeight(7);
            } else {
                strokeWeight(1);
            }
            arc(390, CONSTANTS.P2_CARDS_Y, 50, 50, i*72 + 15 - 90, (i+1)*72 - 15 - 90);
        }
        
        noStroke();
        fill(changableColor());
		//////////////// yellow if doubledddd
        text("X2", 390, CONSTANTS.P1_CARDS_Y);
        text("X2", 390, CONSTANTS.P2_CARDS_Y);
        
		
		// renders fake cards sliding down (remove when done)
		strokeWeight(3);
		PlayScene.slidingCards = PlayScene.slidingCards
		.filter(function(slideCard){
			var renderX = 75 + 100 * slideCard.index;
			var renderY;
			var offsetY = (CONSTANTS.DELAYS.SLIDE_CARD - slideCard.progress)*5;
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
				item.vel[1] += 0.7; // gravity
			}
			var itemImg = getImg(item.itemName);
			var imgSize = cellSize;
			image(
				itemImg, 
				item.renderPos[0], item.renderPos[1], 
				imgSize, imgSize
			);
			return item.renderPos[1] < 700;
		});
		
		
		// renders targeted slot borders and score
		if (PlayScene.targetedPositions !== null){
			// renders borders
			strokeWeight(5); 
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
				cellSize*0.4,cellSize*0.4,10);
				if (obj.point > 0) {fill(CONSTANTS.COLOR_3);}
				else {fill(CONSTANTS.COLOR_4);}
				textSize(30);
				var slotPoint = (obj.point > 0 ? "+":"") + obj.point;
				noStroke();
				text(slotPoint, renderPos[0],renderPos[1]);
			});
			
			// renders center
			var cRenderPos = getRenderPos(PlayScene.hoveredPos);
			var totalPoints = strikedItems.reduce(function(p,obj){
				return p + obj.point;
			},0);
			fill(CONSTANTS.COLOR_5); textSize(50);
			noStroke();
			if (totalPoints > 0) {totalPoints = "+"+totalPoints;}
			// apply shaking if is doubled
				if ((PlayScene.p1.brokenBoxes >= 5 && PlayScene.isP1Turn) || (PlayScene.p2.brokenBoxes >= 5 && !PlayScene.isP1Turn)){
				text(totalPoints, cRenderPos[0] + random(-2, 2), cRenderPos[1] + random(-2, 2));
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
			300, 70, 10);
			fill(CONSTANTS.COLOR_5);
			textSize(35);
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
					scene = CONSTANTS.SCENES.MENU;
				}
			}
		}
	}
	else if (scene === CONSTANTS.SCENES.HELP){
		textAlign(LEFT,LEFT);
		textSize(18);
		fill(250, 250, 0);
		var rules = [
			"- Each turn you can play 2 cards.",
			"A box appears where you play a card.",
			"Another box appears randomly at the end of turn.",
			"\n- Double score gained for the next card after\nbreaking 5 boxes.",
			"\n- A box has either BLUE gem (50%),",
			"ORANGE gem (25%), or nothing (25%).",
			"		+1 when breaking a BOX.",
			"		+2 when breaking a BLUE gem.",
			"		+3 when breaking multiple ORANGE gems.",
			"		-3 when breaking a single ORANGE gem.",
			"\n- Winning against computer doubles your points!"
		];
		text(rules.join("\n"),40,80);
		textAlign(CENTER,CENTER);
		fill(CONSTANTS.COLOR_5);
		text("Click to go back...",300,550);
	}

}

function _(num) {
  return width / 460 * num;
}