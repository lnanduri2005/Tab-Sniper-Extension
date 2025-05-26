// Fix for ball getting stuck and cannon movement issues

document.addEventListener("DOMContentLoaded", () => {
    // Game elements
    const gameContainer = document.getElementById("game-container");
    const cannon = document.getElementById("cannon");
    const cannonBarrel = document.getElementById("cannon-barrel");
    const ball = document.getElementById("ball");
    const bucket = document.getElementById("bucket");
    const scoreElement = document.getElementById("score");
    const gameMessage = document.getElementById("game-message");
    
    // Game variables
    let score = 0;
    let angle = 60; // MODIFIED: Starting angle higher (was 45)
    let direction = 1; // 1 = up, -1 = down
    let animating = false;
    let gameInitialized = false;
    let ballX = 0;
    let ballY = 0;
    let velocityX = 0;
    let velocityY = 0;
    let gravity = 0.8;
    let animationFrame = null;
    let oscillationSpeed = 2.5; // Increased speed for quicker rotation
    let bucketMoving = false;
    let bucketDirection = 1;
    let bucketPosition = 20;
    let bucketSpeed = 2.5;
    let shotsRemaining = 3;
    let startTime = 0; // Initialize the start time variable
    
    // Track game session scores
    let sessionScore = 0;
    
    // Check if game should be initialized when popup opens
    chrome.runtime.sendMessage({ action: "getTimerState" }, (response) => {
        if (response && response.timerActive) {
            // Don't auto-initialize - will be triggered by URL delete attempt
        }
    });
    
    // Initialize game
    function initGame() {
        if (gameInitialized) return;
        
        gameContainer.style.display = "block";
        showGameMessage("3 SHOTS MAX! Score 3 points to break free!");
        
        // Reset session variables
        sessionScore = 0;
        shotsRemaining = 3;
        
        // Randomize gravity between 0.7 and 1.0 (higher = harder)
        gravity = 0.7 + Math.random() * 0.3;
        
        // Start the cannon oscillation
        startCannonMovement();
        
        // Start bucket movement
        startBucketMovement();
        
        // Add click event to shoot
        cannon.addEventListener("mousedown", startShooting);
        cannon.addEventListener("touchstart", startShooting, { passive: true });
        
        gameInitialized = true;
        angle = 60; // MODIFIED: Starting angle higher (was 45)
        updateCannonRotation();
        score = 0;
        updateScore();
        
        // Position the cannon at the same level as the bucket
        cannon.style.bottom = "10px";
    }
    
    // Move the bucket for added difficulty
    function startBucketMovement() {
        bucketMoving = true;
        
        function moveBucket() {
            if (!gameInitialized || !bucketMoving) return;
            
            // Move bucket back and forth
            bucketPosition += bucketDirection * bucketSpeed;
            
            // Container width minus bucket width
            const maxPosition = gameContainer.clientWidth - 50;
            
            // Change direction at limits
            if (bucketPosition >= maxPosition) {
                bucketPosition = maxPosition;
                bucketDirection = -1;
            } else if (bucketPosition <= 20) {
                bucketPosition = 20;
                bucketDirection = 1;
            }
            
            // Update bucket position
            bucket.style.right = bucketPosition + "px";
            
            // Continue the animation
            requestAnimationFrame(moveBucket);
        }
        
        requestAnimationFrame(moveBucket);
    }
    
    // Stop game
    function stopGame() {
        // Only stop if the game is actually running
        if (!gameInitialized) return;
        
        gameContainer.style.display = "none";
        if (animationFrame) {
            cancelAnimationFrame(animationFrame);
            animationFrame = null;
        }
        
        // Reset ball position
        ball.style.display = "none";
        
        // Reset variables
        animating = false;
        gameInitialized = false;
        bucketMoving = false;
    }
    
    // Update the score display
    function updateScore() {
        scoreElement.textContent = `Score: ${sessionScore}/3 (${shotsRemaining} shots left)`;
    }
    
    // Show game message
    function showGameMessage(message) {
        gameMessage.textContent = message;
        gameMessage.style.opacity = 1;
        setTimeout(() => {
            gameMessage.style.opacity = 0;
        }, 2000);
    }
    
    // Start cannon oscillation
    function startCannonMovement() {
        if (animationFrame) {
            cancelAnimationFrame(animationFrame);
            animationFrame = null;
        }
        
        function animate() {
            if (!gameInitialized) return;
            
            // Move the cannon angle up and down
            angle += direction * oscillationSpeed;
            
            // MODIFIED: Change direction at new limits
            if (angle >= 90) { // Upper limit increased (was 85)
                angle = 90;
                direction = -1;
            } else if (angle <= 20) { // Lower limit increased (was 5)
                angle = 20;
                direction = 1;
            }
            
            updateCannonRotation();
            
            // Continue the animation
            animationFrame = requestAnimationFrame(animate);
        }
        
        animationFrame = requestAnimationFrame(animate);
    }
    
    // Update cannon rotation based on current angle
    function updateCannonRotation() {
        cannonBarrel.style.transform = `rotate(${angle}deg)`;
    }
    
    // Handle cannon click to shoot
    function startShooting(e) {
        e.preventDefault();
        
        if (animating || shotsRemaining <= 0) return;
        
        // Stop the cannon movement
        if (animationFrame) {
            cancelAnimationFrame(animationFrame);
            animationFrame = null;
        }
        
        // User releases to shoot
        document.addEventListener("mouseup", shoot, { once: true });
        document.addEventListener("touchend", shoot, { once: true });
    }
    
    // Shoot the ball
    function shoot() {
        if (animating || shotsRemaining <= 0) return;
        
        // Reduce shots remaining
        shotsRemaining--;
        updateScore();
        
        // Calculate the position based on the cannon angle
        const radians = (angle * Math.PI) / 180;
        const power = 15; // Base power
        
        // Set initial position
        ball.style.display = "block";
        ball.style.width = "5px";
        ball.style.height = "5px";
        
        // Starting position - from left side at cannon level
        ballX = 25 + Math.cos(radians) * 40;
        ballY = 10 + Math.sin(radians) * 40; // Adjusted to match cannon's position
        
        // Set initial position
        ball.style.left = ballX + "px";
        ball.style.bottom = ballY + "px";
        
        // Set velocity based on angle
        velocityX = Math.cos(radians) * power;
        velocityY = Math.sin(radians) * power;
        
        // Apply some random drift to make it harder
        velocityX += (Math.random() - 0.5) * 1.5; // Reduced randomness
        velocityY += (Math.random() - 0.5) * 1.5; // Reduced randomness
        
        // Set start time for animation timeout
        startTime = Date.now();
        
        // Start animation
        animating = true;
        animateBall();
    }
    
    // Animate the ball's trajectory
    function animateBall() {
        if (!animating) return;
        
        // Apply physics
        ballX += velocityX;
        ballY += velocityY;
        velocityY -= gravity;
        
        // Reduced wind effect for more predictable trajectory
        velocityX += (Math.random() - 0.5) * 0.1;
        
        // Update ball position
        ball.style.left = ballX + "px";
        ball.style.bottom = ballY + "px";
        
        // Improved ground collision detection
        if (ballY <= 0) {
            // FIXED: Immediately end shot when ball hits ground
            endShot(false);
            return;
        }
        
        // Check for ball hitting the right wall
        if (ballX >= gameContainer.clientWidth - 10) {
            ballX = gameContainer.clientWidth - 10;
            velocityX = -velocityX * 0.5; // Bounce with energy loss
        }
        
        // Check for ball hitting the left wall
        if (ballX <= 0) {
            ballX = 0;
            velocityX = -velocityX * 0.5; // Bounce with energy loss
        }
        
        // Check for ball in bucket - need more precise detection
        const bucketRect = bucket.getBoundingClientRect();
        const ballRect = ball.getBoundingClientRect();
        
        // Make hit detection more precise and harder - must be within center of bucket
        if (ballRect.right > (bucketRect.left + 10) && 
            ballRect.left < (bucketRect.right - 10) &&
            ballRect.bottom > bucketRect.top &&
            ballRect.bottom < (bucketRect.top + 10) && 
            ballY < 50) { // Close to bottom where bucket is
            
            // Ball in bucket!
            sessionScore += 1;
            updateScore();
            
            // Only end the timer if player gets 3 points in a session
            if (sessionScore >= 3) {
                showGameMessage("YOU WIN! UNLOCKING EVERYTHING!");
                
                // End the timer by setting it to current time
                chrome.runtime.sendMessage({ action: "expireTimer" });
                
                // RESET EVERYTHING - clear blocked URLs
                resetEverything();
                
                // Stop the game after a delay
                setTimeout(() => {
                    stopGame();
                }, 1500);
            } else {
                // Show message for scoring but not ending timer
                showGameMessage("GREAT SHOT! " + (3 - sessionScore) + " more to win!");
            }
            
            endShot(true);
            return;
        }
        
        // Add maximum animation time to prevent endless animation
        if (Date.now() - startTime > 10000) { // 10 seconds max
            endShot(false);
            return;
        }
        
        // Continue animation
        animationFrame = requestAnimationFrame(animateBall);
    }
    
    // Function to completely reset the extension state
    function resetEverything() {
        // End the timer
        chrome.runtime.sendMessage({ action: "expireTimer" });
        
        // Clear all blocked URLs
        chrome.storage.sync.get("blockedUrls", (data) => {
            chrome.runtime.sendMessage({ action: "updateUrls", urls: [] });
        });
        
        // Reset extension state to beginning
        chrome.storage.sync.set({ 
            enabled: false,
            timerActive: false,
            timerEndTime: 0
        });
    }
    
    // End the current shot
    function endShot(success) {
        // FIXED: Immediately hide ball
        ball.style.display = "none";
        
        // Cancel any ongoing animation
        if (animationFrame) {
            cancelAnimationFrame(animationFrame);
            animationFrame = null;
        }
        
        // Reset animation state
        animating = false;
        
        // FIXED: Start cannon movement immediately if not the last shot or game winning shot
        if (shotsRemaining > 0 && !(success && sessionScore >= 3)) {
            startCannonMovement();
        }
        
        // Check if out of shots or continue
        if (shotsRemaining <= 0) {
            // If session score is less than 3 and we're out of shots, show "GO LOCK IN!" message
            if (sessionScore < 3) {
                showGameMessage("GO LOCK IN!");
                
                // Stop the game after 2 seconds to ensure message is visible
                setTimeout(() => {
                    stopGame();
                }, 2000);
            }
        }
    }
    
    // Export functions for popup.js to use
    window.gameController = {
        initGame,
        stopGame
    };
});