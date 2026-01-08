// Fix for ball getting stuck and cannon movement issues

document.addEventListener("DOMContentLoaded", () => {
    const gameContainer = document.getElementById("game-container");
    const cannon = document.getElementById("cannon");
    const cannonBarrel = document.getElementById("cannon-barrel");
    const ball = document.getElementById("ball");
    const bucket = document.getElementById("bucket");
    const scoreElement = document.getElementById("score");
    const gameMessage = document.getElementById("game-message");

    let score = 0;
    let angle = 60;
    let direction = 1;
    let animating = false;
    let gameInitialized = false;
    let ballX = 0;
    let ballY = 0;
    let velocityX = 0;
    let velocityY = 0;
    let gravity = 0.8;
    let animationFrame = null;
    let oscillationSpeed = 2.5;
    let bucketMoving = false;
    let bucketDirection = 1;
    let bucketPosition = 20;
    let bucketSpeed = 2.5;
    let shotsRemaining = 3;
    let startTime = 0;
    let sessionScore = 0;

    chrome.runtime.sendMessage({ action: "getTimerState" }, (response) => {
        if (response && response.timerActive) {
            // No-op, game starts on demand.
        }
    });

    function initGame() {
        if (gameInitialized) return;

        gameContainer.style.display = "block";
        showGameMessage("3 SHOTS MAX! Score 3 points to break free!");

        sessionScore = 0;
        shotsRemaining = 3;
        gravity = 0.7 + Math.random() * 0.3;

        startCannonMovement();
        startBucketMovement();

        cannon.addEventListener("mousedown", startShooting);
        cannon.addEventListener("touchstart", startShooting, { passive: true });

        gameInitialized = true;
        angle = 60;
        updateCannonRotation();
        score = 0;
        updateScore();

        cannon.style.bottom = "10px";
    }

    function startBucketMovement() {
        bucketMoving = true;

        function moveBucket() {
            if (!gameInitialized || !bucketMoving) return;

            bucketPosition += bucketDirection * bucketSpeed;
            const maxPosition = gameContainer.clientWidth - 50;

            if (bucketPosition >= maxPosition) {
                bucketPosition = maxPosition;
                bucketDirection = -1;
            } else if (bucketPosition <= 20) {
                bucketPosition = 20;
                bucketDirection = 1;
            }

            bucket.style.right = bucketPosition + "px";
            requestAnimationFrame(moveBucket);
        }

        requestAnimationFrame(moveBucket);
    }

    function stopGame() {
        if (!gameInitialized) return;

        gameContainer.style.display = "none";
        if (animationFrame) {
            cancelAnimationFrame(animationFrame);
            animationFrame = null;
        }

        ball.style.display = "none";
        animating = false;
        gameInitialized = false;
        bucketMoving = false;
    }

    function updateScore() {
        scoreElement.textContent = `Score: ${sessionScore}/3 (${shotsRemaining} shots left)`;
    }

    function showGameMessage(message) {
        gameMessage.textContent = message;
        gameMessage.style.opacity = 1;
        setTimeout(() => {
            gameMessage.style.opacity = 0;
        }, 2000);
    }

    function startCannonMovement() {
        if (animationFrame) {
            cancelAnimationFrame(animationFrame);
            animationFrame = null;
        }

        function animate() {
            if (!gameInitialized) return;

            angle += direction * oscillationSpeed;
            if (angle >= 90) {
                angle = 90;
                direction = -1;
            } else if (angle <= 20) {
                angle = 20;
                direction = 1;
            }

            updateCannonRotation();
            animationFrame = requestAnimationFrame(animate);
        }

        animationFrame = requestAnimationFrame(animate);
    }

    function updateCannonRotation() {
        cannonBarrel.style.transform = `rotate(${angle}deg)`;
    }

    function startShooting(e) {
        e.preventDefault();
        if (animating || shotsRemaining <= 0) return;

        if (animationFrame) {
            cancelAnimationFrame(animationFrame);
            animationFrame = null;
        }

        document.addEventListener("mouseup", shoot, { once: true });
        document.addEventListener("touchend", shoot, { once: true });
    }

    function shoot() {
        if (animating || shotsRemaining <= 0) return;

        shotsRemaining--;
        updateScore();

        const radians = (angle * Math.PI) / 180;
        const power = 15;

        ball.style.display = "block";
        ball.style.width = "5px";
        ball.style.height = "5px";

        ballX = 25 + Math.cos(radians) * 40;
        ballY = 10 + Math.sin(radians) * 40;
        ball.style.left = ballX + "px";
        ball.style.bottom = ballY + "px";

        velocityX = Math.cos(radians) * power;
        velocityY = Math.sin(radians) * power;

        velocityX += (Math.random() - 0.5) * 1.5;
        velocityY += (Math.random() - 0.5) * 1.5;

        startTime = Date.now();
        animating = true;
        animateBall();
    }

    function animateBall() {
        if (!animating) return;

        ballX += velocityX;
        ballY += velocityY;
        velocityY -= gravity;
        velocityX += (Math.random() - 0.5) * 0.1;

        ball.style.left = ballX + "px";
        ball.style.bottom = ballY + "px";

        if (ballY <= 0) {
            endShot(false);
            return;
        }

        if (ballX >= gameContainer.clientWidth - 10) {
            ballX = gameContainer.clientWidth - 10;
            velocityX = -velocityX * 0.5;
        }

        if (ballX <= 0) {
            ballX = 0;
            velocityX = -velocityX * 0.5;
        }

        const bucketRect = bucket.getBoundingClientRect();
        const ballRect = ball.getBoundingClientRect();

        if (
            ballRect.right > bucketRect.left + 10 &&
            ballRect.left < bucketRect.right - 10 &&
            ballRect.bottom > bucketRect.top &&
            ballRect.bottom < bucketRect.top + 10 &&
            ballY < 50
        ) {
            sessionScore += 1;
            updateScore();

            if (sessionScore >= 3) {
                showGameMessage("YOU WIN! UNLOCKING EVERYTHING!");
                chrome.runtime.sendMessage({ action: "expireTimer" });
                resetEverything();
                setTimeout(() => {
                    stopGame();
                }, 1500);
            } else {
                showGameMessage(`GREAT SHOT! ${3 - sessionScore} more to win!`);
            }

            endShot(true);
            return;
        }

        if (Date.now() - startTime > 10000) {
            endShot(false);
            return;
        }

        animationFrame = requestAnimationFrame(animateBall);
    }

    function resetEverything() {
        chrome.runtime.sendMessage({ action: "expireTimer" });
        chrome.storage.sync.get("blockedUrls", () => {
            chrome.runtime.sendMessage({ action: "updateUrls", urls: [] });
        });
        chrome.storage.sync.set({
            enabled: false,
            timerActive: false,
            timerEndTime: 0
        });
    }

    function endShot(success) {
        ball.style.display = "none";

        if (animationFrame) {
            cancelAnimationFrame(animationFrame);
            animationFrame = null;
        }

        animating = false;

        if (shotsRemaining > 0 && !(success && sessionScore >= 3)) {
            startCannonMovement();
        }

        if (shotsRemaining <= 0) {
            if (sessionScore < 3) {
                showGameMessage("GO LOCK IN!");
                setTimeout(() => {
                    stopGame();
                }, 2000);
            }
        }
    }

    window.gameController = {
        initGame,
        stopGame
    };
});
