let isPaused = true;



let CANVAS_WIDTH, HEIGHT_RATIO;
function setup(){
	HEIGHT_RATIO = 1.3;
	CANVAS_WIDTH = min(
		document.documentElement.clientWidth,
		document.documentElement.clientHeight/HEIGHT_RATIO
	);
	createCanvas(
		CANVAS_WIDTH,
		CANVAS_WIDTH*HEIGHT_RATIO
	).parent("overlay");



}



function draw(){
	touchCountdown--;
	background(0);
}


let touchCountdown = 0;
function touchEnded(){
	if (touchCountdown > 0) return;
	else touchCountdown = 3;


	
}