import { ParserService } from './electron/services/parser/index';
import * as path from 'path';

async function testEpub() {
  const parser = new ParserService();
  const filePath = path.join(__dirname, 'Fantastic Mr Fox (Roald Dahl) (Z-Library).epub');
  
  console.log('Testing EPUB:', filePath);
  console.log('========================================');
  
  try {
    const result = await parser.parseEpub(filePath, { maxChapters: 5 });
    
    console.log('\nBook Title:', result.title);
    console.log('Author:', result.author);
    console.log('\nChapters:');
    
    result.chapters.forEach((chapter, index) => {
      console.log(`\n${index + 1}. ID: ${chapter.id}`);
      console.log(`   Title: "${chapter.title}"`);
      console.log(`   Content preview: "${chapter.content.slice(0, 80)}..."`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testEpub();
