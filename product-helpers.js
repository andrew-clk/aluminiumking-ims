// Chinese to Pinyin mapping for common characters in supplier names
const pinyinMap = {
  '加': 'jia', '尼': 'ni', '兴': 'xing',
  '厚': 'hou', '华': 'hua',
  '好': 'hao', '莱': 'lai', '誉': 'yu',
  '迈': 'mai', '比': 'bi', '克': 'ke'
};

// Function to convert Chinese characters to pinyin
function chineseToPinyin(text) {
  let result = '';
  for (let char of text) {
    result += pinyinMap[char] || char;
  }
  return result;
}

// Function to generate SKU prefix from supplier name
function generateSKUPrefix(supplierName) {
  if (!supplierName) return '';

  // Check if supplier name contains Chinese characters
  const hasChinese = /[\u4e00-\u9fa5]/.test(supplierName);

  if (hasChinese) {
    // Convert Chinese to pinyin
    const pinyin = chineseToPinyin(supplierName);
    return pinyin.substring(0, 4).toUpperCase();
  } else {
    // Take first 4 letters of English name
    return supplierName.replace(/\s+/g, '').substring(0, 4).toUpperCase();
  }
}

// Function to generate random 4-digit code
function generateRandomCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// Export for use in main file
window.productHelpers = {
  generateSKUPrefix,
  generateRandomCode,
  chineseToPinyin
};
