<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Remova Background Remover & Editor</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://kit.fontawesome.com/a7c1815598.js" crossorigin="anonymous"></script>
    <!-- Firebase SDK Imports for Environment Compliance -->
    <script type="module">
        import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
        import { getAuth, signInAnonymously, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
        import { getFirestore, collection, addDoc, onSnapshot, query } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
        import { setLogLevel } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

        // Initialize Firebase variables globally
        window.firebaseApp = null;
        window.firebaseAuth = null;
        window.firestoredb = null;
        window.currentUserId = null;
        window.isAuthReady = false;

        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        let firebaseConfig = {};
        try {
            firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
        } catch (e) {
            console.error("Failed to parse firebase config:", e);
        }

        const authInit = async () => {
            if (Object.keys(firebaseConfig).length > 0) {
                try {
                    setLogLevel('Debug');
                    window.firebaseApp = initializeApp(firebaseConfig);
                    window.firestoredb = getFirestore(window.firebaseApp);
                    window.firebaseAuth = getAuth(window.firebaseApp);

                    const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

                    if (initialAuthToken) {
                        await signInWithCustomToken(window.firebaseAuth, initialAuthToken);
                    } else {
                        await signInAnonymously(window.firebaseAuth);
                    }
                    window.currentUserId = window.firebaseAuth.currentUser?.uid || crypto.randomUUID();
                    window.isAuthReady = true;
                    console.log("Firebase initialized and signed in. User ID:", window.currentUserId);

                    // Call the history loader once authenticated
                    if (typeof loadHistory === 'function') {
                        loadHistory();
                    }

                } catch (error) {
                    console.error("Firebase initialization or sign-in failed:", error);
                    window.isAuthReady = true; // Mark as ready even if error occurred
                }
            } else {
                 console.warn("Firebase config not available. Proceeding without Firebase.");
                 window.isAuthReady = true;
            }
        };

        authInit();
    </script>

    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap');
        body {
            font-family: 'Inter', sans-serif;
            background-color: #f7fafc;
        }
        .drop-zone {
            border: 2px dashed #a0aec0;
            transition: border-color 0.3s, background-color 0.3s;
        }
        .drop-zone.dragover {
            border-color: #4299e1;
            background-color: #ebf8ff;
        }
        /* Custom checkerboard background for transparent areas */
        .checkerboard {
            background-color: #f0f0f0;
            background-image: linear-gradient(45deg, #ccc 25%, transparent 25%),
                              linear-gradient(-45deg, #ccc 25%, transparent 25%),
                              linear-gradient(45deg, transparent 75%, #ccc 75%),
                              linear-gradient(-45deg, transparent 75%, #ccc 75%);
            background-size: 20px 20px;
            background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
        }
        .history-item {
            cursor: pointer;
            transition: background-color 0.2s;
        }
        .history-item:hover {
            background-color: #f3f4f6;
        }
        /* Style for color selector buttons */
        .color-selector {
            width: 3rem;
            height: 3rem;
            border-radius: 9999px; /* full circle */
            border: 3px solid transparent;
            cursor: pointer;
            transition: transform 0.1s, border-color 0.1s;
        }
        .color-selector.selected {
            border-color: #4f46e5; /* Indigo for selection */
            transform: scale(1.1);
        }
        /* Style for the canvas preview inside its fixed-size container */
        #compositeCanvas {
            max-width: 100%;
            max-height: 100%;
            display: block;
        }
    </style>
</head>
<body class="min-h-screen flex items-start justify-center p-4">

    <div class="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-4 gap-4">

        <!-- History Sidebar (1/4 width on desktop) -->
        <aside class="lg:col-span-1 bg-white rounded-xl p-4 shadow-lg h-full max-h-[90vh] overflow-y-auto">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-xl font-bold text-gray-800">Processing History</h2>
                <div id="userIdDisplay" class="text-xs text-blue-500 bg-blue-100 px-2 py-1 rounded-full truncate max-w-[50%]">Loading User...</div>
            </div>
            <p id="historyEmpty" class="text-sm text-gray-500 italic hidden">Your history is empty. Upload an image to start!</p>
            <div id="historyContainer" class="space-y-3">
                <!-- History items will be inserted here -->
            </div>
        </aside>

        <!-- Main Application Content (3/4 width on desktop) -->
        <div class="lg:col-span-3 bg-white rounded-xl p-8 shadow-lg">
            <header class="text-center mb-6">
                <h1 class="text-4xl font-extrabold text-gray-900 mb-2">Instant Background Remover & Editor</h1>
                <p class="text-gray-500">Upload, remove, edit, and download your perfectly cut-out images.</p>
            </header>
            
            <!-- Usage Meter & Pro CTA -->
            <div id="usageMeterContainer" class="bg-yellow-50 border border-yellow-200 p-3 rounded-lg flex items-center justify-between mb-8">
                <p class="text-sm font-medium text-yellow-800">
                    <i class="fas fa-magic mr-2"></i> Free Tier Usage: <span id="usageCountText">Loading...</span>
                </p>
                <button id="proCtaButton" class="px-3 py-1 bg-indigo-600 text-white text-xs font-semibold rounded-full hover:bg-indigo-700 transition-colors hidden">
                    Unlock Unlimited <i class="fas fa-lock ml-1"></i>
                </button>
            </div>

            <main>
                <div id="uploadContainer" class="drop-zone flex flex-col items-center justify-center p-12 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                    <i class="fas fa-cloud-upload-alt text-4xl text-blue-500 mb-4"></i>
                    <p class="text-lg font-semibold text-gray-700 mb-1">Drag & drop an image here</p>
                    <p class="text-sm text-gray-500 mb-4">or click to upload (JPG, PNG, up to 10MB)</p>
                    <button onclick="document.getElementById('fileInput').click()" class="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg shadow-md hover:bg-blue-700 transition-all active:scale-95">
                        Select Photo
                    </button>
                    <input type="file" id="fileInput" accept="image/png, image/jpeg" class="hidden">
                </div>

                <div id="loading" class="hidden text-center mt-8 p-6 bg-blue-50 rounded-lg">
                    <i class="fas fa-sync-alt fa-spin text-3xl text-blue-600 mb-3"></i>
                    <p class="text-lg font-semibold text-blue-800">Processing image... Please wait.</p>
                    <p class="text-sm text-blue-600">The background is being intelligently removed by the AI.</p>
                </div>

                <!-- RESULTS AND EDITOR SECTION -->
                <div id="resultsContainer" class="hidden mt-10">

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                        <!-- Original Image -->
                        <div class="flex flex-col items-center">
                            <h2 class="text-xl font-bold text-gray-700 mb-4">Original Image</h2>
                            <div class="w-full h-80 rounded-lg border border-gray-200 overflow-hidden bg-gray-100 flex items-center justify-center">
                                <img id="originalImage" class="max-w-full max-h-full object-contain" alt="Original Image">
                            </div>
                        </div>

                        <!-- Result Image (Canvas Preview) -->
                        <div class="flex flex-col items-center">
                            <h2 class="text-xl font-bold text-gray-700 mb-4">Edited Result Preview</h2>
                            <div id="resultPreviewContainer" class="w-full h-80 rounded-lg border-4 border-indigo-500 overflow-hidden flex items-center justify-center checkerboard">
                                <!-- The canvas for rendering the composite image -->
                                <canvas id="compositeCanvas"></canvas>
                            </div>
                            <!-- Download button downloads the canvas content -->
                            <button id="downloadButton" class="mt-4 px-6 py-3 bg-green-600 text-white font-medium rounded-lg shadow-md hover:bg-green-700 transition-all active:scale-95">
                                <i class="fas fa-download mr-2"></i> Download Final Image
                            </button>
                        </div>
                    </div>

                    <!-- BACKGROUND EDITOR CONTROLS -->
                    <div id="editorControls" class="p-6 bg-indigo-50 border-t-2 border-indigo-200 rounded-lg shadow-inner">
                        <h3 class="text-2xl font-semibold text-indigo-700 mb-4">Edit Background</h3>
                        <div class="flex flex-col sm:flex-row gap-6">

                            <!-- Color Options -->
                            <div class="flex-1">
                                <p class="font-medium text-gray-600 mb-2">1. Choose a Solid Color:</p>
                                <div class="flex flex-wrap gap-3">
                                    <div class="color-selector checkerboard selected" data-color="transparent" title="Transparent"></div>
                                    <div class="color-selector bg-white" data-color="#FFFFFF" title="White"></div>
                                    <div class="color-selector bg-black" data-color="#000000" title="Black"></div>
                                    <div class="color-selector bg-red-500" data-color="#EF4444" title="Red"></div>
                                    <div class="color-selector bg-blue-500" data-color="#3B82F6" title="Blue"></div>
                                    <div class="color-selector bg-green-500" data-color="#10B981" title="Green"></div>
                                    <input type="color" id="customColor" value="#cccccc" class="color-selector p-0 border-none w-12 h-12">
                                </div>
                            </div>

                            <!-- Image Upload Option -->
                            <div class="flex-1 border-t sm:border-t-0 sm:border-l border-gray-300 pl-0 sm:pl-6 pt-4 sm:pt-0">
                                <p class="font-medium text-gray-600 mb-2">2. Use a Custom Image:</p>
                                <button onclick="document.getElementById('bgFileInput').click()" class="w-full px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg shadow-md hover:bg-indigo-700 transition-all active:scale-95">
                                    <i class="fas fa-image mr-2"></i> Upload Background
                                </button>
                                <input type="file" id="bgFileInput" accept="image/png, image/jpeg" class="hidden">
                                <button id="removeBgImageButton" class="hidden w-full mt-2 px-4 py-2 bg-gray-300 text-gray-700 font-medium rounded-lg shadow-md hover:bg-gray-400 transition-all active:scale-95">
                                    <i class="fas fa-times mr-2"></i> Clear Background Image
                                </button>
                                <p id="bgImageStatus" class="mt-2 text-sm text-gray-500 italic hidden">Custom background loaded.</p>
                            </div>

                        </div>
                    </div>

                </div>

                <div id="errorMessage" class="hidden text-center mt-8 p-6 bg-red-100 text-red-700 rounded-lg">
                    <i class="fas fa-exclamation-triangle mr-2"></i>
                    <span id="errorText"></span>
                </div>

            </main>
        </div>
    </div>

    <script>
        const API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=";
        const API_KEY = ""; // The platform provides the key at runtime
        const USAGE_LIMIT = 5; // The number of free background removals allowed

        // DOM Elements
        const fileInput = document.getElementById('fileInput');
        const uploadContainer = document.getElementById('uploadContainer');
        const loading = document.getElementById('loading');
        const resultsContainer = document.getElementById('resultsContainer');
        const originalImage = document.getElementById('originalImage');
        const downloadButton = document.getElementById('downloadButton');
        const errorMessage = document.getElementById('errorMessage');
        const errorText = document.getElementById('errorText');
        const historyContainer = document.getElementById('historyContainer');
        const historyEmpty = document.getElementById('historyEmpty');
        const userIdDisplay = document.getElementById('userIdDisplay');
        const usageCountText = document.getElementById('usageCountText');
        const proCtaButton = document.getElementById('proCtaButton');
        
        // Editor Elements
        const compositeCanvas = document.getElementById('compositeCanvas');
        const bgFileInput = document.getElementById('bgFileInput');
        const colorSelectors = document.querySelectorAll('.color-selector');
        const customColorInput = document.getElementById('customColor');
        const removeBgImageButton = document.getElementById('removeBgImageButton');
        const bgImageStatus = document.getElementById('bgImageStatus');

        let currentForegroundImage = null; // Image object of the transparent PNG result
        let currentResultBase64 = null; // Base64 string of the transparent PNG result (used for history saving only)
        let currentBackground = { type: 'color', value: 'transparent', image: null }; // State for the current background
        let historyCount = 0; // Tracks current usage
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

        // --- Utility Functions ---

        function showMessage(text, type = 'error') {
            errorText.textContent = text;
            errorMessage.className = `text-center mt-8 p-6 rounded-lg ${type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`;
            errorMessage.classList.remove('hidden');
        }

        function clearUI() {
            loading.classList.add('hidden');
            resultsContainer.classList.add('hidden');
            errorMessage.classList.add('hidden');
            uploadContainer.classList.remove('hidden');
            
            // Reset editor state
            currentForegroundImage = null;
            currentResultBase64 = null;
            currentBackground = { type: 'color', value: 'transparent', image: null };
            bgFileInput.value = '';
            removeBgImageButton.classList.add('hidden');
            bgImageStatus.classList.add('hidden');
            
            // Re-select transparent color button
            colorSelectors.forEach(el => el.classList.remove('selected'));
            document.querySelector('.color-selector[data-color="transparent"]').classList.add('selected');

            // Clear visual elements
            originalImage.src = '';
            const ctx = compositeCanvas.getContext('2d');
            ctx.clearRect(0, 0, compositeCanvas.width, compositeCanvas.height);
        }

        /**
         * Converts a File object to a Base64 string.
         * @param {File} file
         * @returns {Promise<string>} Base64 string without the data URL prefix.
         */
        function fileToBase64(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => {
                    const base64String = reader.result.split(',')[1];
                    resolve(base64String);
                };
                reader.onerror = error => reject(error);
            });
        }
        
        /**
         * Loads a Base64 string into an Image object.
         * @param {string} base64Data 
         * @returns {Promise<HTMLImageElement>}
         */
        function loadBase64Image(base64Data) {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = () => reject(new Error('Failed to load image from Base64 data.'));
                img.src = `data:image/png;base64,${base64Data}`;
            });
        }
        
        // --- Monetization and Usage Meter ---

        function updateUsageMeter() {
            const remaining = USAGE_LIMIT - historyCount;
            const isLimitReached = remaining < 0; // Check if we are over the limit

            usageCountText.textContent = isLimitReached 
                ? `Limit Reached (${USAGE_LIMIT} images). Unlock Pro!` 
                : `${Math.min(historyCount, USAGE_LIMIT)} of ${USAGE_LIMIT} used (Free)`;
            
            // The download button must be a Pro CTA if the usage count is > the limit
            if (historyCount > USAGE_LIMIT) {
                // Style meter as red/warning
                document.getElementById('usageMeterContainer').className = 'bg-red-50 border border-red-200 p-3 rounded-lg flex items-center justify-between mb-8';
                proCtaButton.classList.remove('hidden');
                
                // Update button to show "Unlock Pro"
                downloadButton.textContent = 'Unlock Pro to Download';
                downloadButton.className = 'mt-4 px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg shadow-md hover:bg-indigo-700 transition-all active:scale-95';
            } else {
                // Style meter as yellow/standard
                document.getElementById('usageMeterContainer').className = 'bg-yellow-50 border border-yellow-200 p-3 rounded-lg flex items-center justify-between mb-8';
                proCtaButton.classList.add('hidden');
                
                // Update button to show "Download Final Image"
                downloadButton.innerHTML = '<i class="fas fa-download mr-2"></i> Download Final Image';
                downloadButton.className = 'mt-4 px-6 py-3 bg-green-600 text-white font-medium rounded-lg shadow-md hover:bg-green-700 transition-all active:scale-95';
            }
        }


        // --- Editing and Canvas Logic ---

        /**
         * Main function to combine the foreground image with the current background setting
         * and render it on the canvas.
         */
        function applyBackground() {
            if (!currentForegroundImage) return;

            const img = currentForegroundImage;
            const canvas = compositeCanvas;
            const ctx = canvas.getContext('2d');

            // Set canvas dimensions to foreground image's original dimensions for high-res output
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            
            // 1. Draw Background
            if (currentBackground.type === 'color') {
                ctx.fillStyle = currentBackground.value === 'transparent' ? 'rgba(0,0,0,0)' : currentBackground.value;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            } else if (currentBackground.type === 'image' && currentBackground.image) {
                const bgImg = currentBackground.image;
                
                // Draw image, stretching to cover the canvas (Cover behavior)
                const ratio = Math.max(canvas.width / bgImg.naturalWidth, canvas.height / bgImg.naturalHeight);
                const w = bgImg.naturalWidth * ratio;
                const h = bgImg.naturalHeight * ratio;
                const x = (canvas.width - w) / 2;
                const y = (canvas.height - h) / 2;
                ctx.drawImage(bgImg, x, y, w, h);
            } else {
                 // Default to transparent if state is inconsistent
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }

            // 2. Draw Foreground (transparent image)
            // Draw the foreground image to fit the canvas dimensions
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        }
        
        function handleColorSelection(color) {
            // Deselect all color buttons
            colorSelectors.forEach(el => el.classList.remove('selected'));
            
            // Select the clicked/changed element
            let targetEl = document.querySelector(`.color-selector[data-color="${color}"]`) || customColorInput;
            if (targetEl.type !== 'color') {
                targetEl.classList.add('selected');
            }
            
            currentBackground = { type: 'color', value: color, image: null };
            removeBgImageButton.classList.add('hidden');
            bgImageStatus.classList.add('hidden');
            applyBackground();
        }
        
        function handleBgImageUpload(file) {
            if (!file || !file.type.startsWith('image/')) {
                showMessage("Please upload a valid background image file.", 'error');
                return;
            }

            const reader = new FileReader();
            reader.onload = async (e) => {
                const img = await loadBase64Image(e.target.result.split(',')[1]);
                currentBackground = { type: 'image', value: 'custom', image: img };
                
                // Update UI state
                colorSelectors.forEach(el => el.classList.remove('selected'));
                removeBgImageButton.classList.remove('hidden');
                bgImageStatus.classList.remove('hidden');
                
                applyBackground();
            };
            reader.readAsDataURL(file);
        }
        
        function clearBgImage() {
            handleColorSelection('transparent'); // Reset to transparent
        }

        // --- Firestore Interaction ---

        function getHistoryCollectionRef() {
            if (!window.firestoredb || !window.currentUserId) {
                console.error("Firestore or User ID not initialized.");
                return null;
            }
            // Private user data path
            const collectionPath = `/artifacts/${appId}/users/${window.currentUserId}/processed_images`;
            return collection(window.firestoredb, collectionPath);
        }

        async function saveResultToHistory(fileName, originalMimeType, originalSize, resultBase64) {
            const historyRef = getHistoryCollectionRef();
            if (!historyRef) return;

            try {
                await addDoc(historyRef, {
                    fileName: fileName,
                    originalMimeType: originalMimeType,
                    originalSize: originalSize, // in bytes
                    resultBase64: resultBase64, // The transparent result
                    timestamp: Date.now()
                });
                console.log("Result saved to history successfully.");
            } catch (error) {
                console.error("Error saving result to history:", error);
            }
        }
        
        window.loadHistory = function() {
            if (!window.isAuthReady) return;
            
            userIdDisplay.textContent = `ID: ${window.currentUserId}`;
            
            const historyRef = getHistoryCollectionRef();
            if (!historyRef) return;

            const historyQuery = query(historyRef);

            onSnapshot(historyQuery, (snapshot) => {
                const results = [];
                snapshot.forEach(doc => {
                    results.push({ id: doc.id, ...doc.data() });
                });

                // Update usage counter
                historyCount = results.length;
                updateUsageMeter();
                
                results.sort((a, b) => b.timestamp - a.timestamp);

                renderHistory(results);
            }, (error) => {
                console.error("Error fetching history:", error);
            });
        }

        function renderHistory(results) {
            historyContainer.innerHTML = '';
            if (results.length === 0) {
                historyEmpty.classList.remove('hidden');
                return;
            }
            historyEmpty.classList.add('hidden');

            results.forEach(item => {
                const resultDataUrl = `data:image/png;base64,${item.resultBase64}`;
                const date = new Date(item.timestamp).toLocaleDateString();

                const historyItemDiv = document.createElement('div');
                historyItemDiv.className = 'history-item p-3 border border-gray-200 rounded-lg flex items-center space-x-3';
                historyItemDiv.onclick = () => loadResultFromHistory(item);

                // Small Image Preview
                historyItemDiv.innerHTML = `
                    <div class="w-10 h-10 flex-shrink-0 rounded checkerboard overflow-hidden border border-gray-300">
                        <img src="${resultDataUrl}" alt="Result" class="w-full h-full object-contain">
                    </div>
                    <div>
                        <p class="text-sm font-medium text-gray-800 truncate">${item.fileName}</p>
                        <p class="text-xs text-gray-500">${date}</p>
                    </div>
                `;
                historyContainer.appendChild(historyItemDiv);
            });
        }

        async function loadResultFromHistory(item) {
            clearUI();
            uploadContainer.classList.add('hidden');
            resultsContainer.classList.remove('hidden');
            downloadButton.classList.remove('hidden');
            
            try {
                // Load the transparent result into the Image object
                currentForegroundImage = await loadBase64Image(item.resultBase64);
                currentResultBase64 = item.resultBase64; 
                
                // Apply the default (transparent) background to display the checkerboard result
                handleColorSelection('transparent'); // Calls applyBackground() inside
                
                // Set placeholder for the original image
                originalImage.src = `https://placehold.co/${currentForegroundImage.naturalWidth}x${currentForegroundImage.naturalHeight}/cccccc/000000?text=History+Item%0A${item.fileName}`;

            } catch (error) {
                 console.error("Error loading history item:", error);
                 showMessage(`Failed to load history item: ${error.message}`);
                 clearUI();
            }
        }

        // --- API Interaction ---

        async function removeBackground(base64Image, mimeType) {
            const prompt = "Remove the background from this image. Only return the primary subject of the image. The resulting image must have a transparent background.";
            const url = API_URL + API_KEY;

            const payload = {
                contents: [
                    {
                        parts: [
                            { text: prompt },
                            {
                                inlineData: {
                                    mimeType: mimeType,
                                    data: base64Image
                                }
                            }
                        ]
                    }
                ],
                generationConfig: {
                    responseModalities: ['TEXT', 'IMAGE']
                }
            };

            let response;
            let result;
            const maxRetries = 3;
            let delay = 1000;

            for (let i = 0; i < maxRetries; i++) {
                try {
                    response = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });

                    if (!response.ok) {
                        if (response.status === 429 || response.status >= 500) {
                            console.warn(`API call failed with status ${response.status}. Retrying in ${delay / 1000}s...`);
                            if (i < maxRetries - 1) {
                                await new Promise(resolve => setTimeout(resolve, delay));
                                delay *= 2;
                                continue;
                            }
                        }
                        const errorData = await response.json();
                        throw new Error(`API Request failed: ${response.status} - ${errorData.error?.message || response.statusText}`);
                    }

                    result = await response.json();

                    const base64Data = result?.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;

                    if (!base64Data) {
                        throw new Error("API response was successful but did not contain image data.");
                    }

                    return base64Data;

                } catch (error) {
                    if (i === maxRetries - 1) {
                        throw error;
                    }
                }
            }
        }

        // --- Event Handlers ---

        async function processFile(file) {
            clearUI();

            // *** PAYWALL CHECK 1: Prevent API call if limit is reached ***
            if (historyCount >= USAGE_LIMIT) {
                showMessage(`Free tier limit reached (${USAGE_LIMIT} images). Please click 'Unlock Pro' to process more and download.`, 'error');
                updateUsageMeter();
                return;
            }

            if (!file || !file.type.startsWith('image/')) {
                showMessage("Please upload a valid image file (JPG or PNG).");
                return;
            }

            if (file.size > 10 * 1024 * 1024) {
                 showMessage("The file size must be under 10MB.");
                return;
            }

            uploadContainer.classList.add('hidden');
            loading.classList.remove('hidden');

            try {
                // 1. Convert File and Display Original
                const base64Data = await fileToBase64(file);
                const originalDataUrl = `data:${file.type};base64,${base64Data}`;
                originalImage.src = originalDataUrl;

                // 2. Call API to Remove Background
                const resultBase64 = await removeBackground(base64Data, file.type);
                currentResultBase64 = resultBase64;
                
                // 3. Load transparent result into Image object for editing
                currentForegroundImage = await loadBase64Image(resultBase64);

                // 4. Display Results (default to transparent background)
                handleColorSelection('transparent'); // Initializes canvas drawing
                
                loading.classList.add('hidden');
                resultsContainer.classList.remove('hidden');
                downloadButton.classList.remove('hidden');

                // 5. Save to History (Increments usage count via onSnapshot)
                if (window.isAuthReady) {
                    // Only save the transparent result, not the edited composite
                    saveResultToHistory(file.name, file.type, file.size, resultBase64); 
                }
                // Note: updateUsageMeter is called automatically via onSnapshot listener

            } catch (error) {
                console.error("Image processing error:", error);
                loading.classList.add('hidden');
                uploadContainer.classList.remove('hidden');
                showMessage(`An error occurred: ${error.message}. Please try a different image or refresh the page.`);
            }
        }

        // --- Initial Setup and Listeners ---

        document.addEventListener('DOMContentLoaded', () => {
            // Color Selector Listeners
            colorSelectors.forEach(el => {
                if (el.id !== 'customColor') { // Exclude the input type="color" itself
                    el.addEventListener('click', () => handleColorSelection(el.dataset.color));
                }
            });
            customColorInput.addEventListener('input', (e) => handleColorSelection(e.target.value));

            // Custom Background Image Listener
            bgFileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    handleBgImageUpload(e.target.files[0]);
                }
            });
            removeBgImageButton.addEventListener('click', clearBgImage);

            // File Input Listener
            fileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    processFile(e.target.files[0]);
                }
            });

            // Download Functionality (Updated for Paywall and Canvas)
            downloadButton.addEventListener('click', () => {
                // The historyCount check is against the saved images, which is always the transparent PNG.
                // The user can edit, but must pay to download the final edited product if they're over the limit.
                if (historyCount > USAGE_LIMIT) { 
                     // *** PAYWALL CHECK 2: Display Pro CTA instead of downloading ***
                    showMessage(`You've reached your free download limit of ${USAGE_LIMIT} images. Click 'Unlock Pro' to enable unlimited, high-resolution downloads!`, 'info');
                    return;
                }

                if (currentForegroundImage) {
                    // Download the composite image from the canvas
                    const dataURL = compositeCanvas.toDataURL('image/png'); 
                    const link = document.createElement('a');
                    link.href = dataURL;
                    link.download = 'edited-background-image.png';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                } else {
                    showMessage("No processed image available for download.", 'info');
                }
            });
            
            proCtaButton.addEventListener('click', () => {
                showMessage("This is where you would redirect the user to a subscription/payment page to buy the 'Pro' feature, enabling unlimited downloads!", 'info');
            });
            
            // --- Drag and Drop Handlers ---
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                uploadContainer.addEventListener(eventName, preventDefaults, false);
                document.body.addEventListener(eventName, preventDefaults, false);
            });

            function preventDefaults(e) {
                e.preventDefault();
                e.stopPropagation();
            }

            ['dragenter', 'dragover'].forEach(eventName => {
                uploadContainer.addEventListener(eventName, () => uploadContainer.classList.add('dragover'), false);
            });

            ['dragleave', 'drop'].forEach(eventName => {
                uploadContainer.addEventListener(eventName, () => uploadContainer.classList.remove('dragover'), false);
            });

            uploadContainer.addEventListener('drop', (e) => {
                const dt = e.dataTransfer;
                const files = dt.files;
                if (files.length > 0) {
                    processFile(files[0]);
                }
            }, false);
            
            // Initial call to update the meter on load, before history data returns
            updateUsageMeter();
        });

    </script>
</body>
</html>
