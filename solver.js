function findSolution(bolts) {
    const numBolts = bolts.length;
    const colorToId = Object.create(null);
    let nextId = 1;

    // 1. Bitwise State Encoding
    const startState = new Uint16Array(16);
    for (let i = 0; i < numBolts; i++) {
        let b = 0;
        // Bolts[i][0] is the top nut. Shift the bottom nut to 0, top to highest.
        for (let j = 0; j < bolts[i].length; j++) {
            const color = bolts[i][j];
            if (!colorToId[color]) colorToId[color] = nextId++;
            const shift = (bolts[i].length - 1 - j) * 4;
            b |= (colorToId[color] << shift);
        }
        startState[i] = b;
    }

    const MASKS = [0x0000, 0x000F, 0x00FF, 0x0FFF, 0xFFFF];
    const POP_MASKS = [0, 0, 0x000F, 0x00FF, 0x0FFF];

    function getCount(bolt) {
        return (bolt > 0xFFF) ? 4 : (bolt > 0xFF) ? 3 : (bolt > 0xF) ? 2 : (bolt > 0) ? 1 : 0;
    }

    // 2. The "Killer" Heuristic
    function getHeuristic(state) {
        const maxF = new Int32Array(16);
        let totalNuts = 0;
        
        for (let i = 0; i < numBolts; i++) {
            const b = state[i];
            if (b === 0) continue;
            
            const count = getCount(b);
            totalNuts += count;

            const c = b & 0xF;
            let fSize = 1;
            
            // Measure how many matching colors start from the bottom
            if (count >= 2 && ((b >> 4) & 0xF) === c) {
                fSize = 2;
                if (count >= 3 && ((b >> 8) & 0xF) === c) {
                    fSize = 3;
                    if (count === 4 && ((b >> 12) & 0xF) === c) {
                        fSize = 4;
                    }
                }
            }
            if (fSize > maxF[c]) maxF[c] = fSize;
        }
        
        let h = totalNuts;
        for (let c = 1; c < 16; c++) h -= maxF[c];
        return h;
    }

    // 3. Pre-allocated Memory Arena
    const MAX_NODES = 4000000;
    const states = new Uint16Array(MAX_NODES * 16);
    const gVals = new Int32Array(MAX_NODES);
    const hVals = new Int32Array(MAX_NODES);
    const parents = new Int32Array(MAX_NODES);
    const movesSrc = new Uint8Array(MAX_NODES);
    const movesDst = new Uint8Array(MAX_NODES);
    let nodeCount = 0;

    function addNode(state, g, h, pIdx, src, dst) {
        if (nodeCount >= MAX_NODES) return -1;
        const idx = nodeCount++;
        states.set(state, idx * 16);
        gVals[idx] = g;
        hVals[idx] = h;
        parents[idx] = pIdx;
        movesSrc[idx] = src;
        movesDst[idx] = dst;
        return idx;
    }

    function encode(state) {
        return String.fromCharCode(
            state[0], state[1], state[2], state[3], 
            state[4], state[5], state[6], state[7], 
            state[8], state[9], state[10], state[11],
            state[12], state[13], state[14], state[15]
        );
    }

    // 4. Custom Min-Heap (Priority Queue)
    const heap = new Int32Array(MAX_NODES);
    let heapSize = 0;

    function compare(idxA, idxB) {
        const fA = gVals[idxA] + hVals[idxA];
        const fB = gVals[idxB] + hVals[idxB];
        if (fA === fB) return hVals[idxA] - hVals[idxB]; 
        return fA - fB;
    }

    function pushHeap(nodeIdx) {
        let i = heapSize++;
        while (i > 0) {
            const p = (i - 1) >> 1;
            if (compare(nodeIdx, heap[p]) >= 0) break;
            heap[i] = heap[p];
            i = p;
        }
        heap[i] = nodeIdx;
    }

    function popHeap() {
        const result = heap[0];
        const last = heap[--heapSize];
        if (heapSize === 0) return result;
        let i = 0;
        while ((i << 1) + 1 < heapSize) {
            let left = (i << 1) + 1;
            let right = left + 1;
            let smallest = (right < heapSize && compare(heap[right], heap[left]) < 0) ? right : left;
            if (compare(last, heap[smallest]) <= 0) break;
            heap[i] = heap[smallest];
            i = smallest;
        }
        heap[i] = last;
        return result;
    }

    // Setup A* Search
    const visited = new Map();
    const startH = getHeuristic(startState);
    const startIdx = addNode(startState, 0, startH, -1, 0, 0);
    
    pushHeap(startIdx);
    visited.set(encode(startState), 0);

    const tempState = new Uint16Array(16);

    // 5. Main Search Loop
    while (heapSize > 0) {
        const currIdx = popHeap();
        const g = gVals[currIdx];
        const h = hVals[currIdx];
        const pSrc = movesSrc[currIdx];
        const pDst = movesDst[currIdx];

        // Win condition (h === 0 means all nuts are perfectly stacked into foundations of 4)
        if (h === 0) {
            const path = [];
            let curr = currIdx;
            while (parents[curr] !== -1) {
                path.push({ src: movesSrc[curr], dst: movesDst[curr] });
                curr = parents[curr];
            }
            return path.reverse();
        }

        const stateOffset = currIdx * 16;
        for (let i = 0; i < 16; i++) tempState[i] = states[stateOffset + i];

        for (let src = 0; src < numBolts; src++) {
            const srcBolt = tempState[src];
            if (srcBolt === 0) continue;

            const srcCount = getCount(srcBolt);
            const nut = (srcBolt >> ((srcCount - 1) * 4)) & 0xF;
            
            const isUniform = srcBolt === ((nut * 0x1111) & MASKS[srcCount]);
            let emptyUsed = false;

            for (let dst = 0; dst < numBolts; dst++) {
                if (src === dst) continue;
                
                // Pruning: Do not immediately reverse the move just made
                if (currIdx !== 0 && src === pDst && dst === pSrc) continue;

                const dstBolt = tempState[dst];
                const dstCount = getCount(dstBolt);

                if (dstCount < 4) {
                    if (dstCount === 0) {
                        if (isUniform) continue; // Don't move perfectly stacked bolt to empty space
                        if (emptyUsed) continue; // Symmetry: Only use the FIRST available empty bolt
                        emptyUsed = true;
                    } else {
                        if (((dstBolt >> ((dstCount - 1) * 4)) & 0xF) !== nut) continue;
                    }

                    const nextState = new Uint16Array(tempState);
                    nextState[src] = srcBolt & POP_MASKS[srcCount];
                    
                    // We no longer clear the bolt if it hits 4! It stays as a solid 4-nut integer.
                    nextState[dst] = dstBolt | (nut << (dstCount * 4));

                    const nextG = g + 1;
                    const key = encode(nextState);
                    const visitedG = visited.get(key);

                    if (visitedG === undefined || nextG < visitedG) {
                        visited.set(key, nextG);
                        const nextH = getHeuristic(nextState);
                        const nextIdx = addNode(nextState, nextG, nextH, currIdx, src, dst);
                        if (nextIdx !== -1) pushHeap(nextIdx);
                    }
                }
            }
        }
    }

    return null;
}
