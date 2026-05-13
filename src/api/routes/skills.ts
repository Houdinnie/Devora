import { Router, Request, Response } from 'express';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const skillsDir = process.env.SKILLS_DIR || './skills';
    const files = await readdir(skillsDir);
    const skills = [];
    
    for (const file of files) {
      if (file.endsWith('.md')) {
        try {
          const content = await readFile(join(skillsDir, file), 'utf-8');
          const name = file.replace('.md', '');
          const titleMatch = content.match(/^#\s+(.+)/m);
          const descMatch = content.match(/^## Usage\n\n```\n\/(.+?)\s+(.+?)```/);
          
          skills.push({
            name,
            title: titleMatch ? titleMatch[1] : name,
            command: descMatch ? `/${descMatch[1]}` : `/${name}`,
            description: content.substring(0, 200).replace(/[#*`]/g, '').trim(),
          });
        } catch {
          continue;
        }
      }
    }
    
    res.json({
      count: skills.length,
      skills,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to list skills', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

export default router;