const fs = require('fs');
const path = require('path');

// Function to generate video data from directory
function generateVideoData() {
    const videosDir = 'Z:\\water-treatment-tools\\Videos';
    const outputPath = path.join(__dirname, 'videos-data.js');
    
    try {
        // Check if Z drive mapping exists
        if (!fs.existsSync(videosDir)) {
            console.log('Z: drive mapping not found, using API fallback');
            return;
        }
        
        // Read directory contents
        const files = fs.readdirSync(videosDir);
        
        // Filter for video files
        const videoFiles = files.filter(file => {
            const ext = path.extname(file).toLowerCase();
            return ['.mp4', '.avi', '.mov', '.mkv', '.webm'].includes(ext);
        });
        
        // Generate video objects
        const videos = videoFiles.map(filename => {
            // Extract title from filename (remove extension and clean up)
            const title = path.basename(filename, path.extname(filename))
                .replace(/[-_]/g, ' ')
                .replace(/\b\w/g, l => l.toUpperCase());
            
            return {
                filename: filename,
                title: title,
                description: generateDescription(title)
            };
        });
        
        // Generate JavaScript file content
        const jsContent = `// Auto-generated video data - do not edit manually
// Generated on ${new Date().toISOString()}

const DISCOVERED_VIDEOS = ${JSON.stringify(videos, null, 4)};

// Export for use in script.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DISCOVERED_VIDEOS;
}
`;
        
        // Write the file
        fs.writeFileSync(outputPath, jsContent);
        console.log(`Generated video data for ${videos.length} videos`);
        console.log(`Videos found: ${videos.map(v => v.title).join(', ')}`);
        
        return videos;
        
    } catch (error) {
        console.error('Error generating video data:', error);
        return null;
    }
}

// Function to generate contextual descriptions
function generateDescription(title) {
    const descriptions = {
        'Unit Conversions': 'Master converting between metric and imperial units for flow rates, volumes, pressures, and chemical concentrations in water treatment',
        'Working With Formulas': 'Step-by-step approach to solving water treatment formulas including detention time, flow calculations, and chemical dosing equations',
        'Calculating Area': 'Calculate surface areas for tanks, basins, and treatment units - essential for loading rates, detention times, and process design',
        'Understanding Percentages': 'Apply percentage calculations to chemical concentrations, removal efficiencies, and treatment performance metrics',
        'Calculating Volume': 'Learn to calculate volumes for tanks, reservoirs, and treatment units - critical for storage capacity and chemical dosing calculations',
        'Chemical Dose Problems': 'Master chemical dosing calculations including chlorine, coagulants, and pH adjustment chemicals for optimal treatment performance',
        'Flow Problems': 'Solve flow rate problems, including pump calculations, pipe sizing, and hydraulic loading rates for treatment processes',
        'Force Pressure Head': 'Understand relationships between force, pressure, and head calculations essential for pump operations and system design',
        'Velocity And Flow Rate': 'Calculate velocity and flow rates in pipes, channels, and treatment units - fundamental for hydraulic design and operations',
        'Weight Volume Relationships': 'Understand density, specific gravity, and weight-volume relationships for chemical mixing and treatment process calculations',
        'Source Water': 'Comprehensive review of source water quality parameters, sampling procedures, and regulatory requirements for treatment planning'
    };
    
    // Look for exact match or closest match
    const exactMatch = descriptions[title];
    if (exactMatch) return exactMatch;
    
    // Try to find partial matches
    for (const key in descriptions) {
        if (title.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(title.toLowerCase())) {
            return descriptions[key];
        }
    }
    
    // Default description
    return `Learn ${title.toLowerCase()} - Essential water treatment concepts and calculations for Grade 4 certification`;
}

// Run if called directly
if (require.main === module) {
    generateVideoData();
}

module.exports = { generateVideoData };