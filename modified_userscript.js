// ==UserScript==
// @name Gartic.io EXTREME DENSITY (v14.1 Max Capacity with Anti-Kick)
// @namespace http://tampermonkey.net/
// @version 14.1
// @description Siyah çizgileri korur, paketleri 1500 noktaya kadar doldurur, rate limiting ile atılmayı önler.
// @author You & Gemini
// @match https://gartic.io/*
// @match https://*.gartic.io/*
// @grant none
// @run-at document-start
// ==/UserScript==
(function() {
    'use strict';
    console.log('[AutoDraw] v14.1 EXTREME DENSITY Modu Yüklendi!');

    // --- AYARLAR ---
    let originalSocket = null;
    let gameCode = null;
    let isDrawing = false;
    let drawQueue = [];
    let currentGarticPalette = [];
    // --- KRİTİK EXTREME AYARLAR ---
    // Tek pakette gidecek nokta sayısı. 1500 çok yüksektir.
    // Eğer oyundan atılırsan bunu 1000'e düşür.
    const MAX_POINTS_IN_BATCH = 1500;
    // Çizgileri birleştirme (El kaldırmama) mesafesi
    const CONNECT_DISTANCE = 75;
    let density = 2;
    let skipWhite = true;
    const GARTIC_DRAW_WIDTH = 548;
    const GARTIC_DRAW_HEIGHT = 340;
    let canvas = null;
    let ctx = null;
    // --- RATE LIMITING AYARLARI ---
    let lastPacketTime = 0;
    let minPacketDelay = 100; // Minimum delay between packets in ms

    // --- SOCKET ---
    const originalWebSocket = window.WebSocket;
    window.WebSocket = function(...args) {
        const socket = new originalWebSocket(...args);
        originalSocket = socket;
        return socket;
    };

    setInterval(() => {
        if (window.CACHE_DATA && window.CACHE_DATA.game) {
            const newCode = window.CACHE_DATA.game[2];
            if (newCode && newCode !== gameCode) {
                gameCode = newCode;
                const codeEl = document.getElementById('ad-game-code');
                if(codeEl) codeEl.textContent = gameCode;
            }
        }
    }, 1000);

    function sendPacket(packetData) {
        if (!originalSocket || originalSocket.readyState !== 1 || !gameCode) {
            console.warn('[AutoDraw] Socket not ready or no game code, stopping drawing.');
            isDrawing = false;
            return false;
        }
        try {
            const payload = "42" + JSON.stringify([10, gameCode, packetData]);
            originalSocket.send(payload);
            return true;
        } catch (error) {
            console.error('[AutoDraw] Error sending packet:', error);
            isDrawing = false;
            return false;
        }
    }

    // --- RENK SİSTEMİ ---
    function rgbToGarticHex(r, g, b) {
        return "x" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
    }

    function getClosestDynamicColor(r, g, b, dynamicPalette) {
        let minDist = Infinity;
        let closest = dynamicPalette[0];
        for (let color of dynamicPalette) {
            const dist = (color.r - r)**2 + (color.g - g)**2 + (color.b - b)**2;
            if (dist < minDist) {
                minDist = dist;
                closest = color;
            }
        }
        return closest;
    }

    function findDominantColors(imageData, desiredColorCount = 35) {
        const colorCounts = {};
        const pixels = imageData.data;
        const step = 4 * 2;
        for (let i = 0; i < pixels.length; i += step) {
            const r = pixels[i];
            const g = pixels[i + 1];
            const b = pixels[i + 2];
            const alpha = pixels[i + 3];
            if (alpha < 128) continue;
            const rReduced = Math.floor(r / 16) * 16;
            const gReduced = Math.floor(g / 16) * 16;
            const bReduced = Math.floor(b / 16) * 16;
            const colorKey = `${rReduced},${gReduced},${bReduced}`;
            colorCounts[colorKey] = (colorCounts[colorKey] || 0) + 1;
        }
        const sortedColors = Object.entries(colorCounts).sort(([, countA], [, countB]) => countB - countA);
        let dominantColors = [];
        const addedHexes = new Set();
        for (let i = 0; i < sortedColors.length && dominantColors.length < desiredColorCount; i++) {
            const [key] = sortedColors[i];
            const [r, g, b] = key.split(',').map(Number);
            const hex = rgbToGarticHex(r, g, b);
            if (!addedHexes.has(hex)) {
                dominantColors.push({ r, g, b, hex });
                addedHexes.add(hex);
            }
        }
        if (!dominantColors.some(c => c.hex === "x000000")) dominantColors.push({ r: 0, g: 0, b: 0, hex: "x000000" });
        if (!dominantColors.some(c => c.hex === "xFFFFFF")) dominantColors.push({ r: 255, g: 255, b: 255, hex: "xFFFFFF" });
        // Siyahı EN BAŞA al (Öncelik)
        dominantColors.sort((a, b) => (a.hex === "x000000" ? -1 : (b.hex === "x000000" ? 1 : 0)));
        return dominantColors;
    }

    // --- GÖRÜNTÜ İŞLEME ---
    function processImage(imageFile) {
        if (isDrawing) return;
        const img = new Image();
        const reader = new FileReader();
        reader.onload = (e) => {
            img.src = e.target.result;
        };
        img.onload = () => {
            const statusEl = document.getElementById('ad-status');
            if(statusEl) statusEl.textContent = "Extreme Paketleme...";
            if (!canvas) {
                canvas = document.createElement('canvas');
                ctx = canvas.getContext('2d');
            }
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            tempCanvas.width = img.width;
            tempCanvas.height = img.height;
            tempCtx.drawImage(img, 0, 0);
            currentGarticPalette = findDominantColors(tempCtx.getImageData(0, 0, img.width, img.height), 40);
            console.log("Renkler:", currentGarticPalette);
            canvas.width = GARTIC_DRAW_WIDTH;
            canvas.height = GARTIC_DRAW_HEIGHT;
            ctx.fillStyle = "#FFFFFF";
            ctx.fillRect(0, 0, GARTIC_DRAW_WIDTH, GARTIC_DRAW_HEIGHT);
            const scale = Math.min(GARTIC_DRAW_WIDTH / img.width, GARTIC_DRAW_HEIGHT / img.height);
            const drawW = img.width * scale;
            const drawH = img.height * scale;
            const offsetX = Math.floor((GARTIC_DRAW_WIDTH - drawW) / 2);
            const offsetY = Math.floor((GARTIC_DRAW_HEIGHT - drawH) / 2);
            ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
            const finalImageData = ctx.getImageData(0, 0, GARTIC_DRAW_WIDTH, GARTIC_DRAW_HEIGHT);
            const data = finalImageData.data;
            let colorMap = new Array(GARTIC_DRAW_HEIGHT).fill(0).map(() => new Array(GARTIC_DRAW_WIDTH).fill(null));
            let activeColorsInImage = new Set();
            for (let y = 0; y < GARTIC_DRAW_HEIGHT; y += density) {
                for (let x = 0; x < GARTIC_DRAW_WIDTH; x += density) {
                    const i = (y * GARTIC_DRAW_WIDTH + x) * 4;
                    if (data[i+3] < 128) continue;
                    const matched = getClosestDynamicColor(data[i], data[i+1], data[i+2], currentGarticPalette);
                    if (skipWhite && matched.hex === "xFFFFFF") continue;
                    colorMap[y][x] = matched.hex;
                    activeColorsInImage.add(matched.hex);
                }
            }
            drawQueue = [];
            let sortedColors = currentGarticPalette.filter(c => activeColorsInImage.has(c.hex)).map(c => c.hex);
            // --- SİYAH RENGİ EN ÖNCE VE EN HASSAS İŞLE ---
            for (let colorHex of sortedColors) {
                let allPaths = [];
                let visited = new Uint8Array(GARTIC_DRAW_WIDTH * GARTIC_DRAW_HEIGHT);
                // 1. Trace (Yol Bulma)
                for (let y = 0; y < GARTIC_DRAW_HEIGHT; y += density) {
                    for (let x = 0; x < GARTIC_DRAW_WIDTH; x += density) {
                        if (colorMap[y][x] === colorHex && !visited[y * GARTIC_DRAW_WIDTH + x]) {
                            let path = [];
                            let cx = x, cy = y;
                            while (true) {
                                path.push({x: cx, y: cy});
                                visited[cy * GARTIC_DRAW_WIDTH + cx] = 1;
                                let foundNext = false;
                                let nextX = -1, nextY = -1;
                                for (let dy = -density; dy <= density; dy += density) {
                                    for (let dx = -density; dx <= density; dx += density) {
                                        if (dx===0 && dy===0) continue;
                                        const nx = cx+dx, ny = cy+dy;
                                        if (nx>=0 && nx<GARTIC_DRAW_WIDTH && ny>=0 && ny<GARTIC_DRAW_HEIGHT) {
                                            if (!visited[ny*GARTIC_DRAW_WIDTH+nx] && colorMap[ny][nx] === colorHex) {
                                                nextX = nx; nextY = ny;
                                                foundNext = true;
                                                break;
                                            }
                                        }
                                        if (foundNext) break;
                                    }
                                }
                                if (foundNext) {
                                    cx = nextX; cy = nextY;
                                } else break;
                                if (path.length > 800) break; // Pathleri biraz daha uzun tut
                            }
                            if (path.length > 1) allPaths.push(path);
                        }
                    }
                }
                // 2. Sıralama
                let sortedPaths = [];
                if (allPaths.length > 0) {
                    let currentPath = allPaths.shift();
                    sortedPaths.push(currentPath);
                    while (allPaths.length > 0) {
                        const lastPt = currentPath[currentPath.length-1];
                        let bestIdx = -1, minDist = Infinity, reversed = false;
                        const searchLimit = Math.min(allPaths.length, 150); // Arama limitini artır
                        for (let i=0; i<searchLimit; i++) {
                            const p = allPaths[i];
                            const dStart = (p[0].x - lastPt.x)**2 + (p[0].y - lastPt.y)**2;
                            const dEnd = (p[p.length-1].x - lastPt.x)**2 + (p[p.length-1].y - lastPt.y)**2;
                            if (dStart < minDist) { minDist = dStart; bestIdx = i; reversed = false; }
                            if (dEnd < minDist) { minDist = dEnd; bestIdx = i; reversed = true; }
                        }
                        if (bestIdx === -1) bestIdx = 0;
                        let nextPath = allPaths.splice(bestIdx, 1)[0];
                        if (reversed) nextPath.reverse();
                        if (minDist < (CONNECT_DISTANCE * CONNECT_DISTANCE)) {
                            currentPath = currentPath.concat(nextPath);
                            sortedPaths[sortedPaths.length-1] = currentPath;
                        } else {
                            currentPath = nextPath;
                            sortedPaths.push(currentPath);
                        }
                    }
                }
                // 3. EXTREME PAKETLEME
                if (sortedPaths.length > 0) {
                    drawQueue.push([5, colorHex]);
                    for (let path of sortedPaths) {
                        // Sıkıştırma: Gereksiz noktaları sil
                        const simplePath = simplifyPath(path);
                        let coords = [];
                        for(let p of simplePath) coords.push(Math.round(p.x), Math.round(p.y));
                        for (let i = 0; i < coords.length; i += (MAX_POINTS_IN_BATCH * 2)) {
                            let slice = coords.slice(i, i + (MAX_POINTS_IN_BATCH * 2));
                            if (i > 0) {
                                slice.unshift(coords[i-2], coords[i-1]);
                            }
                            if (slice.length > 2) {
                                drawQueue.push([2, ...slice]);
                            }
                        }
                    }
                }
            }
            console.log(`[AutoDraw] Paket Sayısı: ${drawQueue.length}`);
            startDrawing();
        };
        reader.readAsDataURL(imageFile);
    }

    // Düz çizgileri optimize eden fonksiyon (Gereksiz yükü azaltır)
    function simplifyPath(points) {
        if (points.length < 3) return points;
        const result = [points[0]];
        let lastPoint = points[0];
        for (let i = 1; i < points.length - 1; i++) {
            const dx = Math.abs(points[i].x - lastPoint.x);
            const dy = Math.abs(points[i].y - lastPoint.y);
            // Eğer noktalar çok yakınsa ATLA (Paketi şişirme)
            if (dx + dy < 5) continue;
            result.push(points[i]);
            lastPoint = points[i];
        }
        result.push(points[points.length - 1]);
        return result;
    }

    async function startDrawing() {
        if (!gameCode) {
            alert("Odaya gir!");
            return;
        }
        isDrawing = true;
        const statusEl = document.getElementById('ad-status');
        const userSpeed = parseInt(document.getElementById('ad-speed').value);
        for (let i = 0; i < drawQueue.length; i++) {
            if (!isDrawing) break;
            const packet = drawQueue[i];
            // --- RATE LIMITING ---
            const now = Date.now();
            const timeSinceLast = now - lastPacketTime;
            if (timeSinceLast < minPacketDelay) {
                await new Promise(r => setTimeout(r, minPacketDelay - timeSinceLast));
            }
            lastPacketTime = Date.now();
            sendPacket(packet);
            if(statusEl) statusEl.textContent = `%${Math.floor((i / drawQueue.length) * 100)}`;
            // --- ENHANCED DELAY ---
            // Paket çok büyük olduğu için (1500 nokta), bekleme süresini artırmalıyız.
            // Yoksa sunucu atar. Increased multiplier for safety.
            let waitTime = userSpeed;
            if (packet[0] === 2) { // 1500 nokta için yaklaşık 900ms bekler, increased
                waitTime += (packet.length * 1.0); // Increased from 0.65 to 1.0
            } else {
                waitTime += 60;
            }
            await new Promise(r => setTimeout(r, waitTime));
        }
        isDrawing = false;
        if(statusEl) statusEl.textContent = "Bitti!";
    }

    function createUI() {
        const div = document.createElement('div');
        div.innerHTML = `
        <div style="position:fixed; top:10px; left:10px; width:240px; background:#000; color:#fff; z-index:9999; padding:15px; border-radius:12px; border:1px solid #ff0000; font-family:'Segoe UI', sans-serif; box-shadow:0 10px 30px rgba(255,0,0,0.3);">
        <h3 style="margin:0 0 10px 0; color:#ff3333; font-size:16px; text-align:center; font-weight:800; letter-spacing:1px;">⚠️ EXTREME DENSITY v14.1</h3>
        <input type="file" id="ad-file" accept="image/*" style="width:100%; margin-bottom:15px; font-size:11px; background:#222; color:#fff; border:1px solid #444; padding:8px; border-radius:6px;">
        <div style="display:flex; justify-content:space-between; font-size:11px; color:#888; margin-bottom:2px;">
        <span>Safety Delay</span>
        <span id="lbl-speed" style="color:#ff3333">10</span>
        </div>
        <input type="range" id="ad-speed" min="5" max="100" value="10" style="width:100%; margin-bottom:12px; accent-color: #ff3333;">
        <div style="display:flex; justify-content:space-between; font-size:11px; color:#888; margin-bottom:2px;">
        <span>Min Packet Delay</span>
        <span id="lbl-delay" style="color:#ff3333">100</span>
        </div>
        <input type="range" id="ad-delay" min="50" max="500" value="100" step="10" style="width:100%; margin-bottom:12px; accent-color: #ff3333;">
        <div style="margin-bottom:10px;">
        <label style="font-size:11px; color:#ccc; display:flex; align-items:center;">
        <input type="checkbox" id="ad-skip-white" checked style="margin-right:5px; accent-color: #ff3333;">
        Beyazı Atla
        </label>
        </div>
        <button id="ad-start" style="width:100%; background:linear-gradient(90deg, #b71c1c, #f44336); color:white; border:none; padding:12px; font-weight:bold; border-radius:6px; cursor:pointer; font-size:13px; box-shadow: 0 4px 15px rgba(255,0,0,0.4);">🔥 LİMİTLERİ ZORLA</button>
        <button id="ad-stop" style="width:100%; background:#444; color:white; border:none; padding:8px; margin-top:8px; border-radius:6px; cursor:pointer; font-size:12px;">DURDUR</button>
        <div id="ad-status" style="margin-top:12px; text-align:center; font-size:10px; color:#666;">Hazır</div>
        </div>
        `;
        document.body.appendChild(div);
        document.getElementById('ad-start').onclick = () => {
            const file = document.getElementById('ad-file').files[0];
            skipWhite = document.getElementById('ad-skip-white').checked;
            if(file) processImage(file);
            else alert("Resim seç!");
        };
        document.getElementById('ad-stop').onclick = () => isDrawing = false;
        document.getElementById('ad-speed').oninput = (e) => document.getElementById('lbl-speed').textContent = e.target.value;
        document.getElementById('ad-delay').oninput = (e) => {
            minPacketDelay = parseInt(e.target.value);
            document.getElementById('lbl-delay').textContent = minPacketDelay;
        };
    }

    setTimeout(createUI, 1500);
})();