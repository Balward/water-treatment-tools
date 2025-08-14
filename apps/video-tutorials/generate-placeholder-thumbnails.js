const fs = require('fs');
const path = require('path');

// Configuration
const thumbnailsDir = path.join(__dirname, 'thumbnails');

// List of videos with their info - single professional gray color
const videos = [
    { number: '1', title: 'Unit Conversions', color: '#4a5568' },
    { number: '2', title: 'Working With Formulas', color: '#4a5568' },
    { number: '3', title: 'Understanding\nPercentages', color: '#4a5568' },
    { number: '4', title: 'Calculating Area', color: '#4a5568' },
    { number: '5', title: 'Calculating Volume', color: '#4a5568' },
    { number: '6', title: 'Weight-Volume Relationships', color: '#4a5568' },
    { number: '7', title: 'Force-Pressure-Head', color: '#4a5568' },
    { number: '8', title: 'Velocity and Flow Rate', color: '#4a5568' },
    { number: '9', title: 'Pumps', color: '#4a5568' },
    { number: '10', title: 'The Metric System', color: '#4a5568' },
    { number: '11', title: 'Problem Solving', color: '#4a5568' },
    { number: '12', title: 'Flow Problems', color: '#4a5568' },
    { number: '13', title: 'Chemical Dose Problems', color: '#4a5568' },
    { number: '14', title: 'Source Water', color: '#4a5568' },
    { number: '15', title: 'Water Wells', color: '#4a5568' },
    { number: '16', title: 'Reservoir Problems', color: '#4a5568' },
    { number: '17', title: 'Coagulation and Flocculation', color: '#4a5568' },
    { number: '18', title: 'Coagulation and Flocculation Problems', color: '#4a5568' },
    { number: '19', title: 'Sedimentation', color: '#4a5568' },
    { number: '20', title: 'Sedimentation Problems', color: '#4a5568' },
    { number: '21', title: 'Filtration', color: '#4a5568' },
    { number: '22', title: 'Filtration Problems', color: '#4a5568' },
    { number: '23', title: 'Disinfection', color: '#4a5568' },
    { number: '24', title: 'Disinfection Problems', color: '#4a5568' },
    { number: '25', title: 'Pumps and Motors', color: '#4a5568' },
    { number: '26', title: 'Electricity', color: '#4a5568' },
    { number: '27', title: 'Corrosion Control', color: '#4a5568' },
    { number: '28', title: 'Fluoridation', color: '#4a5568' },
    { number: '29', title: 'Iron and Manganese', color: '#4a5568' },
    { number: '30', title: 'Lime Softening', color: '#4a5568' },
    { number: '31', title: 'Regulations', color: '#4a5568' },
    { number: '32', title: 'Membrane Technology', color: '#4a5568' },
    { number: '33', title: 'Aeration', color: '#4a5568' },
    { number: '34', title: 'Adsorption', color: '#4a5568' },
    { number: '35', title: 'Laboratory', color: '#4a5568' },
    { number: '36', title: 'Laboratory Problems', color: '#4a5568' },
    { number: '37', title: 'Treatment Plant\nChemicals', color: '#4a5568' },
    { number: '38', title: 'Management Principles', color: '#4a5568' }
];

function createThumbnailsDirectory() {
    if (!fs.existsSync(thumbnailsDir)) {
        fs.mkdirSync(thumbnailsDir, { recursive: true });
        console.log(`Created thumbnails directory: ${thumbnailsDir}`);
    }
}

function generateSVGThumbnail(video) {
    const { number, title, color } = video;
    
    // Create a gradient version of the color for visual appeal
    const darkerColor = shadeColor(color, -20);
    
    // Handle explicit newlines or smart text wrapping
    let titleLines = [];
    
    // Check if title has explicit newlines
    if (title.includes('\n')) {
        titleLines = title.split('\n');
    } else {
        // Smart text wrapping based on character count and natural breaks
        const titleWords = title.split(' ');
        
        // Function to estimate text width (rough approximation)
        const estimateWidth = (text) => text.length;
        const maxLineWidth = 25; // Approximate character limit per line
        
        if (titleWords.length <= 1 || title.length <= maxLineWidth) {
            // Single word or short title - one line
            titleLines.push(title);
        } else if (title.length <= maxLineWidth * 2) {
            // Medium title - try to split into 2 balanced lines
            let bestSplit = Math.ceil(titleWords.length / 2);
            let minDifference = Infinity;
            
            // Find the best split point for balanced lines
            for (let i = 1; i < titleWords.length; i++) {
                const line1 = titleWords.slice(0, i).join(' ');
                const line2 = titleWords.slice(i).join(' ');
                const difference = Math.abs(line1.length - line2.length);
                
                if (difference < minDifference && line1.length <= maxLineWidth && line2.length <= maxLineWidth) {
                    minDifference = difference;
                    bestSplit = i;
                }
            }
            
            titleLines.push(titleWords.slice(0, bestSplit).join(' '));
            titleLines.push(titleWords.slice(bestSplit).join(' '));
        } else {
            // Long title - split into 3 lines
            const targetLength = Math.ceil(title.length / 3);
            let currentLine = '';
            let currentLineIndex = 0;
            
            for (let i = 0; i < titleWords.length; i++) {
                const word = titleWords[i];
                const testLine = currentLine ? `${currentLine} ${word}` : word;
                
                if (testLine.length <= maxLineWidth || currentLine === '') {
                    currentLine = testLine;
                } else {
                    // Start new line
                    titleLines[currentLineIndex] = currentLine;
                    currentLine = word;
                    currentLineIndex++;
                    
                    // Prevent more than 3 lines
                    if (currentLineIndex >= 2) break;
                }
            }
            
            // Add the last line
            if (currentLine) {
                titleLines[currentLineIndex] = currentLine;
            }
            
            // If we still have remaining words, add them to the last line
            if (currentLineIndex < titleWords.length - 1) {
                const remainingWords = titleWords.slice(titleWords.indexOf(currentLine.split(' ').pop()) + 1);
                if (remainingWords.length > 0) {
                    titleLines[currentLineIndex] += ' ' + remainingWords.join(' ');
                }
            }
        }
    }
    
    const svg = `
<svg width="360" height="240" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad${number}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${color};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${darkerColor};stop-opacity:1" />
    </linearGradient>
    <filter id="shadow">
      <feDropShadow dx="2" dy="2" stdDeviation="3" flood-color="rgba(0,0,0,0.3)"/>
    </filter>
  </defs>
  
  <!-- Background -->
  <rect width="100%" height="100%" fill="url(#grad${number})" rx="12"/>
  
  <!-- Title (prominent, centered) -->
  ${titleLines.map((line, index) => {
      const yPosition = titleLines.length === 1 ? 130 : 
                       titleLines.length === 2 ? 115 + (index * 30) : 
                       100 + (index * 28);
      const fontSize = 24; // Consistent font size for all thumbnails
      
      return `<text x="180" y="${yPosition}" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="700" 
              text-anchor="middle" fill="white" filter="url(#shadow)">${line}</text>`;
  }).join('\n  ')}
  
  <!-- Water treatment icon/decoration -->
  <circle cx="40" cy="200" r="15" fill="rgba(255,255,255,0.1)"/>
  <circle cx="320" cy="190" r="12" fill="rgba(255,255,255,0.1)"/>
  <circle cx="60" cy="40" r="8" fill="rgba(255,255,255,0.1)"/>
</svg>`;

    return svg.trim();
}

function shadeColor(color, percent) {
    const R = parseInt(color.substring(1, 3), 16);
    const G = parseInt(color.substring(3, 5), 16);
    const B = parseInt(color.substring(5, 7), 16);

    const newR = parseInt(R * (100 + percent) / 100);
    const newG = parseInt(G * (100 + percent) / 100);
    const newB = parseInt(B * (100 + percent) / 100);

    const RR = ((newR < 255) ? newR : 255).toString(16).padStart(2, '0');
    const GG = ((newG < 255) ? newG : 255).toString(16).padStart(2, '0');
    const BB = ((newB < 255) ? newB : 255).toString(16).padStart(2, '0');

    return `#${RR}${GG}${BB}`;
}

function generateAllThumbnails() {
    console.log('Starting placeholder thumbnail generation...');
    console.log(`Thumbnails directory: ${thumbnailsDir}`);
    console.log('');
    
    createThumbnailsDirectory();
    
    videos.forEach(video => {
        const cleanTitle = video.title.replace(/\n/g, ' ');
        const filename = `${video.number} - ${cleanTitle}.svg`;
        const filePath = path.join(thumbnailsDir, filename);
        
        const svgContent = generateSVGThumbnail(video);
        fs.writeFileSync(filePath, svgContent);
        
        console.log(`✓ Generated thumbnail: ${filename}`);
    });
    
    console.log('');
    console.log(`Placeholder thumbnail generation complete!`);
    console.log(`Successfully generated: ${videos.length}/${videos.length} thumbnails`);
}

// Run if called directly
if (require.main === module) {
    generateAllThumbnails();
}

module.exports = { generateAllThumbnails };