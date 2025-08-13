const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const videosDir = 'Z:\\water-treatment-tools\\Videos';
const thumbnailsDir = path.join(__dirname, 'thumbnails');
const thumbnailWidth = 360;
const thumbnailHeight = 240;

// List of videos with their filenames
const videos = [
    '1 - Unit Conversions.mp4',
    '2 - Working With Formulas.mp4',
    '3 - Understanding Percentages.mp4',
    '4 - Calculating Area.mp4',
    '5 - Calculating Volume.mp4',
    '6 - Weight-Volume Relationships.mp4',
    '7 - Force-Pressure-Head.mp4',
    '8 - Velocity and Flow Rate.mp4',
    '9 - Pumps.mp4',
    '10 - The Metric System.mp4',
    '11 - Problem Solving.mp4',
    '12 - Flow Problems.mp4',
    '13 - Chemical Dose Problems.mp4',
    '14 - Source Water.mp4',
    '15 - Water Wells.mp4',
    '16 - Reservoir Problems.mp4',
    '17 - Coagulation and Flocculation.mp4',
    '18 - Coagulation and Flocculation Problems.mp4',
    '19 - Sedimentation.mp4',
    '20 - Sedimentation Problems.mp4',
    '21 - Filtration.mp4',
    '22 - Filtration Problems.mp4',
    '23 - Disinfection.mp4'
];

function createThumbnailsDirectory() {
    if (!fs.existsSync(thumbnailsDir)) {
        fs.mkdirSync(thumbnailsDir, { recursive: true });
        console.log(`Created thumbnails directory: ${thumbnailsDir}`);
    }
}

function generateThumbnailFilename(videoFilename) {
    return path.basename(videoFilename, path.extname(videoFilename)) + '.jpg';
}

function generateThumbnail(videoFilename) {
    return new Promise((resolve, reject) => {
        const videoPath = path.join(videosDir, videoFilename);
        const thumbnailFilename = generateThumbnailFilename(videoFilename);
        const thumbnailPath = path.join(thumbnailsDir, thumbnailFilename);
        
        // Check if video exists
        if (!fs.existsSync(videoPath)) {
            console.warn(`Video not found: ${videoPath}`);
            resolve(false);
            return;
        }
        
        // Check if thumbnail already exists
        if (fs.existsSync(thumbnailPath)) {
            console.log(`Thumbnail already exists: ${thumbnailFilename}`);
            resolve(true);
            return;
        }
        
        // Generate thumbnail using ffmpeg at 30% through the video
        const ffmpegCommand = `ffmpeg -i "${videoPath}" -ss 00:00:30 -vframes 1 -vf "scale=${thumbnailWidth}:${thumbnailHeight}" -q:v 2 "${thumbnailPath}"`;
        
        console.log(`Generating thumbnail for: ${videoFilename}`);
        
        exec(ffmpegCommand, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error generating thumbnail for ${videoFilename}:`, error.message);
                
                // Try alternative approach - grab frame at 10% of video duration
                const altCommand = `ffmpeg -i "${videoPath}" -vf "thumbnail,scale=${thumbnailWidth}:${thumbnailHeight}" -frames:v 1 -q:v 2 "${thumbnailPath}"`;
                
                exec(altCommand, (altError, altStdout, altStderr) => {
                    if (altError) {
                        console.error(`Alternative method also failed for ${videoFilename}:`, altError.message);
                        resolve(false);
                    } else {
                        console.log(`✓ Generated thumbnail (alternative method): ${thumbnailFilename}`);
                        resolve(true);
                    }
                });
            } else {
                console.log(`✓ Generated thumbnail: ${thumbnailFilename}`);
                resolve(true);
            }
        });
    });
}

async function generateAllThumbnails() {
    console.log('Starting thumbnail generation...');
    console.log(`Videos directory: ${videosDir}`);
    console.log(`Thumbnails directory: ${thumbnailsDir}`);
    console.log(`Thumbnail size: ${thumbnailWidth}x${thumbnailHeight}`);
    console.log('');
    
    createThumbnailsDirectory();
    
    let successCount = 0;
    let totalVideos = videos.length;
    
    for (const videoFilename of videos) {
        const success = await generateThumbnail(videoFilename);
        if (success) successCount++;
    }
    
    console.log('');
    console.log(`Thumbnail generation complete!`);
    console.log(`Successfully generated: ${successCount}/${totalVideos} thumbnails`);
    
    if (successCount < totalVideos) {
        console.log('Note: Some thumbnails could not be generated. Make sure:');
        console.log('1. ffmpeg is installed and available in PATH');
        console.log('2. Video files exist in the specified directory');
        console.log('3. You have write permissions to the thumbnails directory');
    }
}

// Run if called directly
if (require.main === module) {
    generateAllThumbnails().catch(console.error);
}

module.exports = { generateAllThumbnails, generateThumbnail };