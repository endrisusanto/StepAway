// Lightweight pure-JS QR Code generator for StepAway SaaS Pairing
// Zero dependencies, outputs clean SVG element
(() => {
  // GF(256) math tables and Galois Field operations
  const EXP_TABLE = new Uint8Array(256);
  const LOG_TABLE = new Uint8Array(256);
  for (let i = 0, x = 1; i < 256; i++) {
    EXP_TABLE[i] = x;
    LOG_TABLE[x] = i;
    x = (x << 1) ^ (x >= 128 ? 0x11d : 0);
  }

  function gfMul(x, y) {
    return (x === 0 || y === 0) ? 0 : EXP_TABLE[(LOG_TABLE[x] + LOG_TABLE[y]) % 255];
  }

  function gfPolyMul(p1, p2) {
    const res = new Uint8Array(p1.length + p2.length - 1);
    for (let i = 0; i < p1.length; i++) {
      for (let j = 0; j < p2.length; j++) {
        res[i + j] ^= gfMul(p1[i], p2[j]);
      }
    }
    return res;
  }

  function getRsGenerator(numEc) {
    let poly = new Uint8Array([1]);
    for (let i = 0; i < numEc; i++) {
      poly = gfPolyMul(poly, new Uint8Array([1, EXP_TABLE[i]]));
    }
    return poly;
  }

  function rsEncode(data, numEc) {
    const gen = getRsGenerator(numEc);
    const res = new Uint8Array(data.length + numEc);
    res.set(data);
    for (let i = 0; i < data.length; i++) {
      const coef = res[i];
      if (coef !== 0) {
        for (let j = 0; j < gen.length; j++) {
          res[i + j] ^= gfMul(gen[j], coef);
        }
      }
    }
    return res.subarray(data.length);
  }

  // Version table capacities for Byte mode with EC Level L (Low) and M (Medium)
  // [totalCodewords, ecCodewordsPerBlock, numBlocks]
  const VERSION_CAPACITIES = [
    null,
    { ver: 1, size: 21, totalCw: 26, ecCw: 7, dataCw: 19 },
    { ver: 2, size: 25, totalCw: 44, ecCw: 10, dataCw: 34 },
    { ver: 3, size: 29, totalCw: 70, ecCw: 15, dataCw: 55 },
    { ver: 4, size: 33, totalCw: 100, ecCw: 20, dataCw: 80 },
    { ver: 5, size: 37, totalCw: 134, ecCw: 26, dataCw: 108 },
    { ver: 6, size: 41, totalCw: 172, ecCw: 18, numBlocks: 2, dataCw: 136 },
    { ver: 7, size: 45, totalCw: 196, ecCw: 20, numBlocks: 2, dataCw: 156 },
    { ver: 8, size: 49, totalCw: 242, ecCw: 24, numBlocks: 2, dataCw: 194 }
  ];

  function getBestVersion(dataLength) {
    // Mode indicator (4 bits) + Char count (8 or 16 bits) + data bytes
    for (let v = 1; v < VERSION_CAPACITIES.length; v++) {
      const info = VERSION_CAPACITIES[v];
      const headerBits = 4 + (v <= 9 ? 8 : 16);
      const neededBytes = Math.ceil((headerBits + dataLength * 8) / 8);
      if (neededBytes <= info.dataCw) return info;
    }
    return VERSION_CAPACITIES[VERSION_CAPACITIES.length - 1];
  }

  function encodeData(text, versionInfo) {
    const bytes = new TextEncoder().encode(text);
    const bitArr = [];

    function pushBits(val, len) {
      for (let i = len - 1; i >= 0; i--) {
        bitArr.push((val >> i) & 1);
      }
    }

    // 1. Mode Indicator: 0100 (Byte mode)
    pushBits(0b0100, 4);

    // 2. Character Count Indicator
    const charCountBits = versionInfo.ver <= 9 ? 8 : 16;
    pushBits(bytes.length, charCountBits);

    // 3. Data bytes
    for (let i = 0; i < bytes.length; i++) {
      pushBits(bytes[i], 8);
    }

    // 4. Terminator bits (up to 4 zeroes)
    const totalDataBits = versionInfo.dataCw * 8;
    const termLen = Math.min(4, totalDataBits - bitArr.length);
    pushBits(0, termLen);

    // 5. Pad to multiple of 8
    while (bitArr.length % 8 !== 0) {
      bitArr.push(0);
    }

    // 6. Convert bit array to byte array
    const dataBytes = new Uint8Array(versionInfo.dataCw);
    for (let i = 0; i < bitArr.length / 8; i++) {
      let b = 0;
      for (let j = 0; j < 8; j++) {
        b = (b << 1) | bitArr[i * 8 + j];
      }
      dataBytes[i] = b;
    }

    // 7. Pad bytes 0xEC, 0x11 until data capacity is reached
    let padByte = 0xec;
    for (let i = Math.floor(bitArr.length / 8); i < versionInfo.dataCw; i++) {
      dataBytes[i] = padByte;
      padByte = padByte === 0xec ? 0x11 : 0xec;
    }

    // 8. Generate RS Error Correction
    let finalCodewords = [];
    if (!versionInfo.numBlocks || versionInfo.numBlocks === 1) {
      const ecBytes = rsEncode(dataBytes, versionInfo.ecCw);
      finalCodewords = [...dataBytes, ...ecBytes];
    } else {
      const numB = versionInfo.numBlocks;
      const bDataLen = Math.floor(versionInfo.dataCw / numB);
      const bEcLen = versionInfo.ecCw;
      const dataBlocks = [];
      const ecBlocks = [];

      for (let b = 0; b < numB; b++) {
        const blkData = dataBytes.subarray(b * bDataLen, (b + 1) * bDataLen);
        dataBlocks.push(blkData);
        ecBlocks.push(rsEncode(blkData, bEcLen));
      }

      // Interleave data
      for (let i = 0; i < bDataLen; i++) {
        for (let b = 0; b < numB; b++) {
          finalCodewords.push(dataBlocks[b][i]);
        }
      }
      // Interleave EC
      for (let i = 0; i < bEcLen; i++) {
        for (let b = 0; b < numB; b++) {
          finalCodewords.push(ecBlocks[b][i]);
        }
      }
    }

    return finalCodewords;
  }

  function createMatrix(size) {
    const mat = [];
    const isReserved = [];
    for (let r = 0; r < size; r++) {
      mat.push(new Uint8Array(size));
      isReserved.push(new Uint8Array(size));
    }
    return { mat, isReserved, size };
  }

  function placeFinderPattern(grid, startR, startC) {
    const { mat, isReserved } = grid;
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const isBlack = (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
        mat[startR + r][startC + c] = isBlack ? 1 : 0;
        isReserved[startR + r][startC + c] = 1;
      }
    }
  }

  function placeSeparators(grid) {
    const { mat, isReserved, size } = grid;
    // Top-left
    for (let i = 0; i < 8; i++) {
      if (i < size) {
        mat[7][i] = 0; isReserved[7][i] = 1;
        mat[i][7] = 0; isReserved[i][7] = 1;
      }
    }
    // Top-right
    for (let i = 0; i < 8; i++) {
      mat[7][size - 8 + i] = 0; isReserved[7][size - 8 + i] = 1;
      mat[i][size - 8] = 0; isReserved[i][size - 8] = 1;
    }
    // Bottom-left
    for (let i = 0; i < 8; i++) {
      mat[size - 8 + i][7] = 0; isReserved[size - 8 + i][7] = 1;
      mat[size - 8][i] = 0; isReserved[size - 8][i] = 1;
    }
  }

  function placeTimingPatterns(grid) {
    const { mat, isReserved, size } = grid;
    for (let i = 8; i < size - 8; i++) {
      if (!isReserved[6][i]) {
        mat[6][i] = (i % 2 === 0) ? 1 : 0;
        isReserved[6][i] = 1;
      }
      if (!isReserved[i][6]) {
        mat[i][6] = (i % 2 === 0) ? 1 : 0;
        isReserved[i][6] = 1;
      }
    }
  }

  function placeAlignmentPattern(grid, centerR, centerC) {
    const { mat, isReserved } = grid;
    for (let r = -2; r <= 2; r++) {
      for (let c = -2; c <= 2; c++) {
        const isBlack = (Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0));
        mat[centerR + r][centerC + c] = isBlack ? 1 : 0;
        isReserved[centerR + r][centerC + c] = 1;
      }
    }
  }

  const ALIGNMENT_COORDS = {
    2: [6, 18],
    3: [6, 22],
    4: [6, 26],
    5: [6, 30],
    6: [6, 34],
    7: [6, 22, 38],
    8: [6, 24, 42]
  };

  function placeAllAlignment(grid, ver) {
    if (ver <= 1) return;
    const coords = ALIGNMENT_COORDS[ver] || [];
    for (let r of coords) {
      for (let c of coords) {
        // Skip finder areas
        if ((r === 6 && c === 6) || (r === 6 && c === coords[coords.length - 1]) || (r === coords[coords.length - 1] && c === 6)) {
          continue;
        }
        placeAlignmentPattern(grid, r, c);
      }
    }
  }

  function reserveFormatInfo(grid) {
    const { isReserved, size } = grid;
    for (let i = 0; i < 9; i++) {
      isReserved[8][i] = 1;
      isReserved[i][8] = 1;
    }
    for (let i = 0; i < 8; i++) {
      isReserved[8][size - 1 - i] = 1;
      isReserved[size - 1 - i][8] = 1;
    }
    // Dark module
    isReserved[size - 8][8] = 1;
    grid.mat[size - 8][8] = 1;
  }

  function placeDataCodewords(grid, codewords) {
    const { mat, isReserved, size } = grid;
    let bitIdx = 0;
    const totalBits = codewords.length * 8;
    let upward = true;

    for (let right = size - 1; right > 0; right -= 2) {
      if (right === 6) right--; // Skip vertical timing pattern column

      const rows = upward
        ? Array.from({ length: size }, (_, i) => size - 1 - i)
        : Array.from({ length: size }, (_, i) => i);

      for (let r of rows) {
        for (let col of [right, right - 1]) {
          if (!isReserved[r][col]) {
            let bitVal = 0;
            if (bitIdx < totalBits) {
              const byteI = Math.floor(bitIdx / 8);
              const bitI = 7 - (bitIdx % 8);
              bitVal = (codewords[byteI] >> bitI) & 1;
              bitIdx++;
            }
            // Apply Mask 0: (row + column) % 2 === 0
            const maskBit = (r + col) % 2 === 0 ? 1 : 0;
            mat[r][col] = bitVal ^ maskBit;
          }
        }
      }
      upward = !upward;
    }
  }

  function placeFormatInfo(grid) {
    // Mask 0 + EC Level L (01) => Format Bits: 111011111000100 (BCH code with mask 101010000010010)
    const formatBits = [1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 0, 0, 1, 0, 0];
    const { mat, size } = grid;

    // Around top-left
    const positionsTopLeft = [
      [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
      [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]
    ];

    positionsTopLeft.forEach(([r, c], idx) => {
      mat[r][c] = formatBits[idx];
    });

    // Around top-right and bottom-left
    for (let i = 0; i < 7; i++) {
      mat[size - 1 - i][8] = formatBits[i];
    }
    for (let i = 0; i < 8; i++) {
      mat[8][size - 8 + i] = formatBits[7 + i];
    }
  }

  function renderSvg(grid, sizePx = 220) {
    const { mat, size } = grid;
    const padding = 3;
    const totalDim = size + padding * 2;
    const cellSize = sizePx / totalDim;

    let paths = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (mat[r][c] === 1) {
          const x = (c + padding) * cellSize;
          const y = (r + padding) * cellSize;
          paths.push(`M${x.toFixed(1)},${y.toFixed(1)}h${cellSize.toFixed(1)}v${cellSize.toFixed(1)}h-${cellSize.toFixed(1)}z`);
        }
      }
    }

    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${sizePx} ${sizePx}" width="${sizePx}" height="${sizePx}" shape-rendering="crispEdges">
        <rect width="${sizePx}" height="${sizePx}" fill="#ffffff" rx="10" />
        <path d="${paths.join(' ')}" fill="#090d16" />
      </svg>
    `;
  }

  window.generateQrCodeSvg = function(text, sizePx = 220) {
    try {
      const verInfo = getBestVersion(text.length);
      const codewords = encodeData(text, verInfo);
      const grid = createMatrix(verInfo.size);

      placeFinderPattern(grid, 0, 0);
      placeFinderPattern(grid, 0, verInfo.size - 7);
      placeFinderPattern(grid, verInfo.size - 7, 0);
      placeSeparators(grid);
      placeTimingPatterns(grid);
      placeAllAlignment(grid, verInfo.ver);
      reserveFormatInfo(grid);
      placeDataCodewords(grid, codewords);
      placeFormatInfo(grid);

      return renderSvg(grid, sizePx);
    } catch (err) {
      console.error('[QR Generation Error]', err);
      return `<div style="color: #ef4444; font-size: 12px; padding: 12px;">Gagal memuat QR Code</div>`;
    }
  };
})();
