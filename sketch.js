let isPaused = true;
let showTitle = true;

const LEVELS = [
    [4,4],
    [6,7],
    [9,11],
    [12,14],
    [15,99],
    [15,99]
];
let lvIndex = 0;

let LAZER_COLOR, GRID_COLOR, HIGHLIGHT_COLOR, PORTAL_A_COLOR, PORTAL_B_COLOR, BG_COLOR;
let U, LAZER_SIZE, RNODES_MIN, RNODES_MAX;

/* ---HELPERS--- */
function increaseDir(currentDir, amount){
    while (amount > 0){
        amount--;
        currentDir++;
        if (currentDir >= 6){
            currentDir = 0;
        }
    }
    return currentDir;
}
function getOppositeDir(dir){
    return increaseDir(dir, 3);
}
function posToKey(pos){
    return "x"+pos[0] + "y"+pos[1];
}
function randomInt(start,end){
    return floor(random(start,end));
}


/* ---TILES DATA--- */
var BASE_TILES_DATA = [
    {x: 5, y: [-5,0]},
    {x: 4, y: [-5,1]},
    {x: 3, y: [-5,2]},
    {x: 2, y: [-5,3]},
    {x: 1, y: [-5,4]},
    {x: 0, y: [-5,5]},
    {x: -1, y: [-4,5]},
    {x: -2, y: [-3,5]},
    {x: -3, y: [-2,5]},
    {x: -4, y: [-1,5]},
    {x: -5, y: [0,5]}
];
var BASE_TILES = [];
// {pos,nodeInfo{name,nodeItem}}
var BASE_TILES_OBJECT = {};
BASE_TILES_DATA.forEach(function(obj) {
	for (var i=obj.y[0]; i <= obj.y[1]; i++){
		BASE_TILES.push([obj.x, i]);
	}
});

var SAFE_TILES_DATA = [
    {x: 3, y: [-4,1]},
    {x: 2, y: [-4,2]},
    {x: 1, y: [-3,2]},
    {x: 0, y: [-2,2]},
    {x: -1, y: [-2,3]},
    {x: -2, y: [-2,4]},
    {x: -3, y: [-1,4]}
];
var SAFE_TILES = [];
SAFE_TILES_DATA.forEach(function(obj) {
	for (var i=obj.y[0]; i <= obj.y[1]; i++){
		SAFE_TILES.push([obj.x, i]);
	}
});


/* ---LOGIC--- */
var isGenerating = true;
var hoveredNode = null;
var hasWon = false;

var NODE_NAMES = {
    SOURCE: "S",
    REDIRECT: "R",
    PORTAL: "P"
};

// S{pos, dir},  P{pos, otherPortal}
var sourceNode, portalA1, portalA2, portalB1, portalB2;
var portalsList = [];
// R{pos, dir1, dir2, lazerIndex(-1 means no lazer)}
var redirectNodes = [];
var lazerData = [];

var DIR_VELS = [
    // u, ul, dl, d, dr, ur
    [0,-1],
    [-1,0],
    [-1,1],
    [0,1],
    [1,0],
    [1,-1]
];

// takes current node item (pos, dir) and returns next pos
function getNextTilePos(pos, dir){
    return [
        pos[0] + DIR_VELS[dir][0],
        pos[1] + DIR_VELS[dir][1]
    ];
}

function isInBlacklist(pos, blacklist){
    return blacklist.some(function(bPos){
        return pos[0] === bPos[0] && pos[1] === bPos[1];
    });
}
function getRandomPos(pool, blacklist, isDeterministic){
    var finalPos;
    while(!finalPos) {
        if (isDeterministic){
            finalPos = pool[floor(Rune.deterministicRandom()*pool.length)];
        }
        else finalPos = pool[randomInt(0,pool.length)];
        // check if match any in black list
        if (isInBlacklist(finalPos, blacklist)){
            finalPos = null;
        }
    }
    return finalPos;
}

function getSurroundingPosArray(pos){
    var posArray = [];
    DIR_VELS.forEach(function(vel){
        var newPos = [pos[0] + vel[0], pos[1] + vel[1]];
        var tileInfo = BASE_TILES_OBJECT[posToKey(newPos)];
        // if within grid
        if (tileInfo){
            // if doesnt have any node
            if (tileInfo.nodeInfo === null){
                posArray.push(newPos);
            }
        }
    });
    return posArray;
}

let portalsBlacklist = [];
let fourPortalPos = [];
function generatePortals(){
    var blacklist = []; // no-spawn pos array

    while (fourPortalPos.length < 4){
        var newRandomPos = getRandomPos(SAFE_TILES, blacklist, true);
        fourPortalPos.push(newRandomPos);
        // add to blacklist
        var newBlacklist = getSurroundingPosArray(newRandomPos);
        blacklist.push(newRandomPos);
        blacklist = blacklist.concat(newBlacklist);
    }

    portalsBlacklist = blacklist; // globalize
}

// return false if unsuccessful
function generateRNodes(){
    var blacklist = [sourceNode.pos];
    // sNode surrounding
    blacklist = blacklist.concat(
        getSurroundingPosArray(sourceNode.pos)
    );
    // portals
    blacklist = blacklist.concat(
        portalsList.map(function(portal){
            return portal.pos;
        })
    );
    
    var currentPos = sourceNode.pos;
    // clear after each rNode creation
    var possibleMoves = []; // {dir from currentPos, pos, distance}
    
    // each dir, returns true if leads to source
    function addPossibleMoves(dir){
        var movingPos = currentPos; // moves along current dir
        var distanceCount = 0;
        var lazerPosArray = []; // pos array
        
        // keep going until out of grid or hit rNode/sNode
        while (true){
            distanceCount++;
            movingPos = getNextTilePos(movingPos, dir);
            
            var currentTileInfo = BASE_TILES_OBJECT[
                posToKey(movingPos)
            ];
            // if out of grid then stop
            if (!currentTileInfo){break;}
            // if pos is empty then add
            else if (currentTileInfo.nodeInfo === null){
                // check if pos is not in blacklist
                if (!isInBlacklist(movingPos, blacklist)){
                    // add move (multiple copies)
                    var newMove = {
                        pos: movingPos,
                        dir: dir,
                        lazerPosArray: lazerPosArray.slice(0)
                    };
                    for (var i=0; i<distanceCount; i++){
                        possibleMoves.push(newMove);
                    }
                    // for next moves, this pos is on lazer path
                    lazerPosArray.push(movingPos);
                }
            }
            // pos is not empty (could be s/r/portal)
            else {
                var nodeInfo = currentTileInfo.nodeInfo;
                // if pos is portal
                if (nodeInfo.name === NODE_NAMES.PORTAL){
                    movingPos = nodeInfo.nodeItem
                    .otherPortal.pos;
                }
                // if pos is rNode then stop
                else if (nodeInfo.name === NODE_NAMES.REDIRECT){
                    break;
                }
                // if pos is sNode then return true
                else if (nodeInfo.name === NODE_NAMES.SOURCE){
                    return true;
                }
            }
        }
        return false;
    }
    
    // for each rNode to be created
    // keep going until stuck (no possible move) or enough rNodes
    while (true){
        var dirThatLeadsToSource = null;
        // go thru all dirs to add possible moves
        for (var i=0; i < DIR_VELS.length; i++){
            // don't do current dir or opposite
            if (redirectNodes.length > 0){
                var lastRNode = redirectNodes[
                    redirectNodes.length-1
                ];
                if (lastRNode.dir1 === i ||
                getOppositeDir(lastRNode.dir1) === i){
                    continue;
                }
            }
            
            var doesLeadToSource = addPossibleMoves(i);
            if (doesLeadToSource){
                dirThatLeadsToSource = i;
            }
        }
        
        // if enough rNodes
        if (redirectNodes.length >= RNODES_MIN){
            //  stop if does lead to source
            if (dirThatLeadsToSource !== null){
                var lastRNode = redirectNodes[
                    redirectNodes.length-1
                ];
                // also add dir2 to last rNode
                lastRNode.dir2 = dirThatLeadsToSource;
                break;
            }
        }
        
        
        

        // stuck? regenerate
        if (possibleMoves.length === 0){ return false;}
        else {
            // pick a move {pos, dir, lazerPosArray}
            var pickedMove = possibleMoves[randomInt(
                0, possibleMoves.length
            )];
            possibleMoves = []; // reset
            
            // set dir2 of current rNode if has any rNode
            if (redirectNodes.length > 0){
                redirectNodes[
                    redirectNodes.length-1
                ].dir2 = pickedMove.dir;
            }
            
            var newRNode = {
                pos: pickedMove.pos,
                dir1: getOppositeDir(pickedMove.dir),
                dir2: null,
                lazerIndex: -1
            };
            // add to rNodes list
            redirectNodes.push(newRNode);
            // add to dictionary
            BASE_TILES_OBJECT[posToKey(newRNode.pos)]
            .nodeInfo = {
                name: NODE_NAMES.REDIRECT,
                nodeItem: newRNode
            };
            
            // add lazer pos array to blacklist
            blacklist = blacklist.concat(pickedMove.lazerPosArray);
            // add surround tiles to blacklist
            for (var i=0; i<DIR_VELS.length; i++){
                var neighborPos = getNextTilePos(newRNode.pos, i);
                blacklist.push(neighborPos);
            }
            
            currentPos = newRNode.pos;
        }
    }
    
    return true;
}

function resetGame(){
    gameEnded = false;
    lvIndex = -1;
    realScore = 0;
    nextLevel();
}

function resetBaseTiles(){
    BASE_TILES.forEach(function(pos){
        BASE_TILES_OBJECT[posToKey(pos)] = {
            pos: pos,
            nodeInfo: null
        };
    });
}

let isSolved = false;
function newPuzzle(){
    // reset data for next level
    hoveredNode = null;
    hasWon = false;
    isSolved = false;
    lazerData = [];
    redirectNodes = [];
    
    // set up map dictionary
    resetBaseTiles();

    // portals: set pos and add to dictionary
    portalsList.forEach(function (portal, i){
        portal.pos = fourPortalPos[i];
        BASE_TILES_OBJECT[posToKey(portal.pos)].nodeInfo = {
            name: NODE_NAMES.PORTAL,
            nodeItem: portal
        };
    });
    
    // generate source node
    sourceNode = {
        pos: getRandomPos(SAFE_TILES, portalsBlacklist),
        dir: randomInt(0,6)
    };
    // set sNode to dictionary
    BASE_TILES_OBJECT[posToKey(sourceNode.pos)].nodeInfo = {
        name: NODE_NAMES.SOURCE,
        nodeItem: sourceNode
    };
    
    // rNodes. regenerate (false) if unsuccessful
    isGenerating = !generateRNodes();
    
    // fail if too many rNodes
    if (redirectNodes.length > RNODES_MAX){
        isGenerating = true;
    }
    
    // scramble rotatable nodes
    if (!isGenerating){
        redirectNodes.forEach(function(rNode){
            var rotateAmount = randomInt(0,5);
            for (var i=0; i < rotateAmount;i ++){
                rNode.dir1 = increaseDir(rNode.dir1, 1);
                rNode.dir2 = increaseDir(rNode.dir2, 1);
            }
        });
    }
}


function getCurrentLazerData(){
    if (lazerData.length === 0){
        return sourceNode;
    } else {
        return lazerData[lazerData.length-1];
    }
}

var lazerHits = {
    rNode: function(rNode){
        var currentLazerData = getCurrentLazerData();
        var entranceDir = getOppositeDir(currentLazerData.dir);
        var outputDir;
        if (entranceDir === rNode.dir1){
            outputDir = rNode.dir2;
        } else if (entranceDir === rNode.dir2){
            outputDir = rNode.dir1;
        }
        // if lazer successfully enters this rNode
        if (typeof outputDir === "number"){
            rNode.lazerIndex = lazerData.length;
            // add an invisible lazer right on this rNode
            lazerData.push({
                pos: rNode.pos,
                dir: outputDir
            });
        }
    },
    portal: function(portal){
        var currentLazerData = getCurrentLazerData();
        lazerData.push({
            pos: portal.otherPortal.pos,
            dir: currentLazerData.dir
        });
    },
    sNode: function(sNode){
        hasWon = redirectNodes.every(function(rNode){
            return rNode.lazerIndex !== -1;
        });
    }
};

// move lazer forward
function updateLazer(){
    hasWon = false; // reset
    var currentLazerData = getCurrentLazerData();
    
    var nextTilePos = getNextTilePos(
        currentLazerData.pos, currentLazerData.dir
    );
    var nextTileInfo = BASE_TILES_OBJECT[posToKey(nextTilePos)];
    
    // check if is within grid
    if ( nextTileInfo ){
        // check if is empty
        if (!nextTileInfo.nodeInfo){
            // move lazer forward
            lazerData.push({
                pos: nextTilePos,
                dir: currentLazerData.dir
            });
        } else {
            var nodeItem = nextTileInfo.nodeInfo.nodeItem;
            switch (nextTileInfo.nodeInfo.name){
                case NODE_NAMES.REDIRECT:
                    lazerHits.rNode(nodeItem);
                    break;
                case NODE_NAMES.PORTAL:
                    lazerHits.portal(nodeItem);
                    break;
                case NODE_NAMES.SOURCE:
                    lazerHits.sNode(nodeItem);
                    break;
            }
        }
    }
}

/* ---RENDER--- */
let offset,TILE_SCALE,HOVER_RANGE,SQRT_3 ,HALF_SQRT_3 ,HALF_TILE_SCALE ,SCALED_SQRT;

function getRenderPos(pos){
    return [offset[0] + pos[0] * TILE_SCALE * 3 / 2, 
    offset[1] + (pos[1] * 2 + pos[0]) * SCALED_SQRT];
}

// returns the end point position of the line segment
function getLineEndPos(pos, dir){
    var renderPos = getRenderPos(pos);
    var x = renderPos[0], y = renderPos[1];
    var CALCULATED_X_OFFSET = TILE_SCALE*0.75;
    var CALCULATED_Y_OFFSET = SCALED_SQRT/2;
    
    switch (dir){
        case 0:
            return [
                x, y - SCALED_SQRT
            ];
        case 1:
            return [
                x - CALCULATED_X_OFFSET, y - CALCULATED_Y_OFFSET
            ];
        case 2:
            return [
                x - CALCULATED_X_OFFSET, y + CALCULATED_Y_OFFSET
            ];
        case 3:
            return [
                x, y + SCALED_SQRT
            ];
        case 4:
            return [
                x + CALCULATED_X_OFFSET, y + CALCULATED_Y_OFFSET
            ];
        case 5:
            return [
                x + CALCULATED_X_OFFSET, y - CALCULATED_Y_OFFSET
            ];
    }
    
    return [0,0]; // unknown dir
}

function renderTile(pos){
    var renderPos = getRenderPos(pos);
    var x = renderPos[0], y = renderPos[1];
    
    beginShape();
    vertex(x + TILE_SCALE, y);
    vertex(x + HALF_TILE_SCALE, y + SCALED_SQRT);
    vertex(x - HALF_TILE_SCALE, y + SCALED_SQRT);
    vertex(x - TILE_SCALE, y);
    vertex(x - HALF_TILE_SCALE, y - SCALED_SQRT);
    vertex(x + HALF_TILE_SCALE, y - SCALED_SQRT);
    endShape(CLOSE);
}
function tileIsHovered(pos){
    var renderPos = getRenderPos(pos);
    var x = renderPos[0], y = renderPos[1];
    return dist(mouseX, mouseY, x, y) < HOVER_RANGE;
}


function renderGrid(){
    strokeWeight(1.5*U);
    stroke(GRID_COLOR);
    noFill();
    BASE_TILES.forEach(function(pos){
        renderTile(pos);
    });
}

let lazerParticles = []; // array of [x,y,vx,vy]
const PARTICLES_ADDITION = 2;
const PARTICLES_LIMIT = 25;

function renderAllLazer(){
    strokeWeight(LAZER_SIZE);
    stroke(hasWon? HIGHLIGHT_COLOR : LAZER_COLOR);
    lazerData.forEach(function(lazerItem, i){
        var end1 = getLineEndPos(lazerItem.pos, lazerItem.dir);
        var end2 = getLineEndPos(lazerItem.pos, 
        getOppositeDir(lazerItem.dir));
        // don't render if already has something there
        if (!BASE_TILES_OBJECT[
            posToKey(lazerItem.pos)
        ].nodeInfo){
            line(end1[0], end1[1], end2[0], end2[1]);
        }
        
        // add particles
        if (i === lazerData.length - 1){
            for (let i = 0; i < PARTICLES_ADDITION; i++){
                lazerParticles.push([
                    end1[0], 
                    end1[1],
                    random(-1.5,1.5),
                    random(-1.5,1.5)
                ]);
            }
        }
    });

    // renders particles
    while (lazerParticles.length > PARTICLES_LIMIT){
        lazerParticles.shift();
    }
    strokeWeight(LAZER_SIZE*0.5);
    for (let i=0; i<lazerParticles.length; i++){
        let particle = lazerParticles[i];
        particle[0] += particle[2] * U;
        particle[1] += particle[3] * U;
        point(particle[0], particle[1]);
    }

}

function renderSourceNode(){
    fill(hasWon? HIGHLIGHT_COLOR : LAZER_COLOR);
    noStroke();
    renderTile(sourceNode.pos);
    if (tileIsHovered(sourceNode.pos)){
        hoveredNode = sourceNode;
    }
}

function renderRedirectNodes(){
    redirectNodes.forEach(function(rNode){
        // gray hex background
        fill(GRID_COLOR);
        noStroke();
        renderTile(rNode.pos);
        
        strokeWeight(LAZER_SIZE);
        // lazer color lines if has lazerIndex > -1
        if (rNode.lazerIndex > -1){
            stroke(hasWon? HIGHLIGHT_COLOR : LAZER_COLOR);
        } else {
            stroke(BG_COLOR);
        }
        var centerPos = getRenderPos(rNode.pos);
        var end1 = getLineEndPos(rNode.pos, rNode.dir1);
        var end2 = getLineEndPos(rNode.pos, rNode.dir2);
        line(centerPos[0], centerPos[1], end1[0], end1[1]);
        line(centerPos[0], centerPos[1], end2[0], end2[1]);
        
        if (tileIsHovered(rNode.pos)){
            hoveredNode = rNode;
        }
    });
}

function renderPortals(){
    portalsList.forEach(function (portal, i){
        let centerPos = getRenderPos(portal.pos);
        
        noStroke();
        fill(i < 2 ? PORTAL_A_COLOR : PORTAL_B_COLOR);
        ellipse(centerPos[0], centerPos[1], 
        TILE_SCALE*1.3, TILE_SCALE*1.3);
            
        let t1 = map(frameCount % 120, 120, 0, 0, 1);
        let t2 = map((frameCount+60) % 120, 120, 0, 0, 1);
        noFill();
        stroke(BG_COLOR);
        strokeWeight(U*40*min(t1,0.1));
        ellipse(centerPos[0], centerPos[1], 
        TILE_SCALE*1.5*t1, TILE_SCALE*1.5*t1);
        strokeWeight(U*40*min(t2,0.1));
        ellipse(centerPos[0], centerPos[1], 
        TILE_SCALE*1.5*t2, TILE_SCALE*1.5*t2);
    });
}

let realScore = 0;
let gameEnded = false;
function nextLevel(){
    // last level ?
    if (lvIndex >= 5){
        if (!gameEnded){
            Rune.gameOver();
            gameEnded = true;
        }
        return;
    }

    lazerParticles = [];
    movesRemaining = 500;
    lvIndex++;
    isGenerating = true;
    loadCountdown = MINIMAL_LOADTIME;
    RNODES_MIN = LEVELS[lvIndex][0];
    RNODES_MAX = LEVELS[lvIndex][1];
    newPuzzle();
}

let movesRemaining;

let loadCountdown;
const MINIMAL_LOADTIME = 10;
let gridImage;
let CANVAS_WIDTH, HEIGHT_RATIO;
function setup(){
	HEIGHT_RATIO = 1.15;
	CANVAS_WIDTH = min(
		document.documentElement.clientWidth,
		document.documentElement.clientHeight/HEIGHT_RATIO
	);
	createCanvas(
		CANVAS_WIDTH,
		CANVAS_WIDTH*HEIGHT_RATIO
	).parent("overlay");

	LAZER_COLOR = color(41, 255, 148);
	GRID_COLOR = color(250, 118, 186);
	HIGHLIGHT_COLOR = color(255, 255, 255);
	PORTAL_A_COLOR = color(41, 255, 251);
	PORTAL_B_COLOR = color(255, 200, 43);
	BG_COLOR = color(54, 0, 37);

	U = width/600;
	LAZER_SIZE = U*12;
	RNODES_MIN = 1;
	RNODES_MAX = 40;

	offset = [width/2, height/2];
	TILE_SCALE = U*34;
	HOVER_RANGE = TILE_SCALE * 1.1;
	SQRT_3 = sqrt(3);
	HALF_SQRT_3 = SQRT_3 / 2;
	HALF_TILE_SCALE = TILE_SCALE / 2;
	SCALED_SQRT = HALF_SQRT_3 * TILE_SCALE;

	textFont(mainFont);
	frameRate(30);
	textAlign(CENTER, CENTER);
	rectMode(CENTER);
	angleMode(DEGREES);
	
    // set up portals
    portalA1 = {};
    portalA2 = {};
    portalB1 = {};
    portalB2 = {};
    portalA1.otherPortal = portalA2;
    portalA2.otherPortal = portalA1;
    portalB1.otherPortal = portalB2;
    portalB2.otherPortal = portalB1;
    portalsList = [portalA1, portalA2, portalB1, portalB2];

    resetBaseTiles();
    generatePortals();

    // take grid image
    renderGrid();
    gridImage = get(0,0,width,height);

    resetGame();

	Rune.init({
		resumeGame: function () {
			isPaused = false;
            showTitle = false;
		},
		pauseGame: function () {
			isPaused = true;
		},
		restartGame: function () {
			resetGame();
		},
		getScore: function () {
			return max(0, realScore);
		}
	});
}

let movesCountShrink = 0; // real size minus this. 0 is at rest 

function draw(){
	touchCountdown--;

	if (isGenerating){
		newPuzzle();
    }
    if (loadCountdown > 0 || isGenerating){
        loadCountdown--;
        clear();
        strokeWeight(U*10);
        stroke(GRID_COLOR);
		noFill();
		const t = frameCount*15;
        arc(width/2, height/2, U*100, U*100, t, t + 200);
        return;
    }
    
    
    hoveredNode = null;
    clear();

    image(gridImage, 0,0, width, height);
    renderSourceNode();
    renderRedirectNodes();
    renderPortals();
    renderAllLazer();
   
    updateLazer();
    

    textSize(50*U);
    strokeWeight(U*5);
    fill(GRID_COLOR);
    noStroke();
    text((lvIndex+1)+"/6", U*80, U*630); // level text

    // score
    text(realScore, U*80, U*50);
    movesCountShrink = max(0, movesCountShrink - 1);
    textSize((30-movesCountShrink)*U);
    text("+"+movesRemaining, U*80, U*90);

    if (hasWon) {
        if (!isSolved){
            isSolved = true;
            realScore += movesRemaining;
        }
    }
    // next button
    if (isSolved){
        strokeWeight(U*3);
		noFill();
		stroke(GRID_COLOR);
        const t = cos(frameCount*10)*3;
		rect(U*520, U*60, U*80+t, U*60+t);
        fill(GRID_COLOR);
        noStroke();
        triangle(U*495, U*45, U*495, U*75, U*530, U*60);
        triangle(U*520, U*45, U*520, U*75, U*550, U*60);
    }
}

function clearRNodes(){
    redirectNodes.forEach(function (rNode){
        if (lazerData.length <= rNode.lazerIndex){
            rNode.lazerIndex = -1;
        }
    });
}

let touchCountdown = 0;
function touchEnded(){
	if (touchCountdown > 0) return;
	else touchCountdown = 3;
	if (hoveredNode){
        // decrease moves
        if (!isSolved){
            movesRemaining = max(0, movesRemaining - 1);
            movesCountShrink = 6; // decrease in size
        }
        if (hoveredNode === sourceNode){
            // sNode
            sourceNode.dir = increaseDir(sourceNode.dir, 1);
            lazerData = [];
            clearRNodes();
        } else {
            // rNode
            var rNode = hoveredNode;
            if (rNode.lazerIndex !== -1){
                // lazer is hitting
                lazerData = lazerData.slice(0, rNode.lazerIndex);
                rNode.lazerIndex = -1;
                var entranceDir = getOppositeDir(
                    getCurrentLazerData().dir
                );
                do {
                    rNode.dir1 = increaseDir(rNode.dir1, 1);
                    rNode.dir2 = increaseDir(rNode.dir2, 1);
                } while (rNode.dir1 !== entranceDir &&
                rNode.dir2 !== entranceDir);
            } else {
                // free rotate
                rNode.dir1 = increaseDir(rNode.dir1, 1);
                rNode.dir2 = increaseDir(rNode.dir2, 1);
            }
            clearRNodes();
        }
    }
    // next button
    else if (isSolved){
        if (abs(520*U - mouseX) < 40*U &&
        abs(60*U - mouseY) < 30*U){
            nextLevel();
        }
    }
}

let mainFont;
function preload(){
	mainFont = loadFont('./Square.ttf');
}