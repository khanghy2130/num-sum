let isPaused = true;

function setup() {
	const HEIGHT_RATIO = 1.2;
	const CANVAS_WIDTH = min(
		document.documentElement.clientWidth,
		document.documentElement.clientHeight/HEIGHT_RATIO
	);
  createCanvas(
    CANVAS_WIDTH * 0.99,
    CANVAS_WIDTH * HEIGHT_RATIO * 0.99
  );
  textAlign(CENTER, CENTER);



  Rune.init({
    resumeGame: function () {
		isPaused = false;
    },
    pauseGame: function () {
		isPaused = true;
    },
    restartGame: function () {
		///// reset game
    },
    getScore: function () {
      ee = "score";
      return 10;
    }
  });
  setTimeout(function () {
    Rune.gameOver(); // only call if not paused, check if paused or resumed
  }, 5000);
}

function draw() {
  //clear();
  background(0);
  fill(250);
  ellipse(_(300), _(300), _(600), _(600));
  fill(0);
  text(isPaused, _(300), _(300));

}

function _(num) {
  return width / 600 * num;
}