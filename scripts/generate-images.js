#!/usr/bin/env node
/**
 * Generate game art using OpenAI GPT Image 1.5.
 *
 * Usage:
 *   node scripts/generate-images.js                # generate all
 *   node scripts/generate-images.js locations       # locations only
 *   node scripts/generate-images.js characters      # characters only
 *   node scripts/generate-images.js locations church # single location
 *   node scripts/generate-images.js characters brad_barber # single character
 *
 * Requires OPENAI_API_KEY env var.
 * Images are saved to public/images/locations/ and public/images/characters/.
 */

import OpenAI from 'openai';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const LOC_DIR = join(ROOT, 'public/images/locations');
const CHAR_DIR = join(ROOT, 'public/images/characters');

const client = new OpenAI();

// ── Style ────────────────────────────────────────────────────────────────────

const STYLE_LOCATION = `Studio Ghibli anime illustration style. Cel-shaded with visible brushwork and soft edges.
Warm golden-hour lighting, rich saturated colors. European fantasy village setting.
Slightly mysterious atmosphere underneath the charm. Detailed but stylized backgrounds.
Consistent palette: warm amber highlights, cool blue-green shadows, earthy stone and wood tones.
No text, no people, no UI elements. Bright and readable.`;

const STYLE_CHARACTER = `Studio Ghibli anime character portrait. Cel-shaded with clean outlines and soft shading.
Shoulder-up portrait, 3/4 view angle. Warm soft lighting from the left side.
Consistent palette: warm skin tones, earthy clothing colors, amber highlights, muted background.
Expressive face with personality. Slightly mysterious atmosphere.
European fantasy village setting implied in the background. No text, no UI elements.`;

// ── Location prompts ─────────────────────────────────────────────────────────

const LOCATIONS = {
  church: {
    name: 'Church',
    prompt: `A charming old stone church in a European village. Colorful stained glass windows glowing warmly. A small bell tower with a cross. Ivy climbing the walls. Soft golden hour light. A few gravestones in the yard add a hint of mystery. ${STYLE_LOCATION}`,
  },
  docks: {
    name: 'Docks',
    prompt: `A picturesque fishing dock at a village harbor. Colorful wooden boats bobbing on calm water. Rope coils and fishing nets draped over posts. Seagulls in the sky. Warm sunset light reflecting off the water. A lighthouse visible in the distance. ${STYLE_LOCATION}`,
  },
  town_square: {
    name: 'Town Square',
    prompt: `A lively village town square with cobblestones and a stone fountain at center. Colorful buildings surrounding it, flower boxes in windows. Warm lampposts with a golden glow. A notice board on one side. Inviting but something feels slightly off. ${STYLE_LOCATION}`,
  },
  market: {
    name: 'Market',
    prompt: `A bustling outdoor village market with colorful canvas-covered stalls. Fresh produce, flowers, and goods on display. Bunting and string lights overhead. Cobblestone ground. Warm and lively atmosphere with rich colors. ${STYLE_LOCATION}`,
  },
  tavern: {
    name: 'Tavern',
    prompt: `A cozy village tavern with warm light pouring from windows. A wooden sign with a painted mug swinging above the door. Stone and timber walls, flower pots by the entrance. Barrels stacked beside the door. Welcoming but with an air of secrets inside. ${STYLE_LOCATION}`,
  },
  library: {
    name: 'Library',
    prompt: `A cozy village library interior with tall wooden bookshelves full of colorful book spines. A reading desk with a warm green lamp. Sunlight streaming through a window. Dust motes floating in the light. Stacks of old books and scrolls add mystery. ${STYLE_LOCATION}`,
  },
};

// ── Character prompts ────────────────────────────────────────────────────────

const CHARACTERS = {
  brad_barber: {
    name: 'Brad the Barber',
    prompt: `Portrait of a chatty middle-aged barber. Thinning hair, big friendly grin. White barber's apron, holds scissors casually. Expressive eyes that suggest he knows everyone's gossip. ${STYLE_CHARACTER}`,
  },
  elena_innkeeper: {
    name: 'Elena the Innkeeper',
    prompt: `Portrait of a warm but shrewd middle-aged woman innkeeper. Hair pinned up neatly. Sturdy dress with rolled sleeves. A knowing look in her eyes — she notices everything. ${STYLE_CHARACTER}`,
  },
  father_gregor: {
    name: 'Father Gregor',
    prompt: `Portrait of an aging village priest. Thin face, kind but intense eyes. Dark clerical collar. Holds a worn Bible. An expression of moral certainty mixed with worry. ${STYLE_CHARACTER}`,
  },
  mira_merchant: {
    name: 'Mira the Merchant',
    prompt: `Portrait of a clever young female merchant. Sharp features, confident half-smile. Wears a practical coat with many pockets. One eyebrow raised as if sizing you up. ${STYLE_CHARACTER}`,
  },
  old_tomas: {
    name: 'Old Tomas',
    prompt: `Portrait of a very old village elder. Wild white eyebrows, suspicious squinting eyes. Deeply weathered face. Heavy wool coat. Looks paranoid but oddly perceptive. ${STYLE_CHARACTER}`,
  },
  dasha_healer: {
    name: 'Dasha the Healer',
    prompt: `Portrait of a gentle village healer woman. Kind eyes, protective expression. Simple dress with an herbal satchel over her shoulder. Looks tired but caring. ${STYLE_CHARACTER}`,
  },
  lev_dockworker: {
    name: 'Lev the Dockworker',
    prompt: `Portrait of a quiet, stocky dockworker. Broad shoulders, weathered tan face. Wears a knit sweater and flat cap. Few words but observant eyes. Strong and steady. ${STYLE_CHARACTER}`,
  },
  anya_seamstress: {
    name: 'Anya the Seamstress',
    prompt: `Portrait of a gossipy young seamstress. Bright animated eyes, mid-sentence expression. Curly hair slightly messy. Wears a colorful dress with a needle tucked behind her ear. ${STYLE_CHARACTER}`,
  },
  piotr_miller: {
    name: 'Piotr the Miller',
    prompt: `Portrait of a gentle, conflict-averse miller. Round friendly face dusted with flour. Wears a cap and apron. Large hands held open in a calming gesture. Wants peace. ${STYLE_CHARACTER}`,
  },
  nadia_librarian: {
    name: 'Nadia the Librarian',
    prompt: `Portrait of an analytical young librarian. Wire-rimmed glasses, sharp intelligent eyes. Hair in a neat bun. High-collared blouse, holds a leather notebook. Thoughtful expression. ${STYLE_CHARACTER}`,
  },
  viktor_farmer: {
    name: 'Viktor the Farmer',
    prompt: `Portrait of a blunt, no-nonsense farmer. Sunburned face, strong jaw, direct stare. Wears a work shirt with suspenders. Says exactly what he thinks — his face shows it. ${STYLE_CHARACTER}`,
  },
  player: {
    name: 'The Inspector',
    prompt: `Portrait of a sharp young detective/inspector. Wears a stylish coat and hat. Keen analytical eyes, holds a small notebook. Confident and determined. The hero of the story. ${STYLE_CHARACTER}`,
  },
};

// ── Generation ───────────────────────────────────────────────────────────────

async function generateImage(prompt, outputPath, size = '1024x1024') {
  console.log(`  Generating: ${outputPath}...`);
  try {
    const response = await client.images.generate({
      model: 'gpt-image-1',
      prompt,
      n: 1,
      size,
      quality: 'medium',
    });

    const imageData = response.data[0].b64_json;
    const buffer = Buffer.from(imageData, 'base64');
    writeFileSync(outputPath, buffer);
    console.log(`  ✓ Saved ${outputPath} (${(buffer.length / 1024).toFixed(0)} KB)`);
    return true;
  } catch (e) {
    console.error(`  ✗ Failed: ${e.message}`);
    return false;
  }
}

async function generateLocations(filter) {
  console.log('\n=== Generating Location Images ===\n');
  mkdirSync(LOC_DIR, { recursive: true });

  const entries = filter
    ? Object.entries(LOCATIONS).filter(([id]) => id === filter)
    : Object.entries(LOCATIONS);

  let success = 0;
  for (const [id, loc] of entries) {
    const path = join(LOC_DIR, `${id}.png`);
    const ok = await generateImage(loc.prompt, path);
    if (ok) success++;
  }
  console.log(`\nLocations: ${success}/${entries.length} generated`);
}

async function generateCharacters(filter) {
  console.log('\n=== Generating Character Portraits ===\n');
  mkdirSync(CHAR_DIR, { recursive: true });

  const entries = filter
    ? Object.entries(CHARACTERS).filter(([id]) => id === filter)
    : Object.entries(CHARACTERS);

  let success = 0;
  for (const [id, char] of entries) {
    const path = join(CHAR_DIR, `${id}.png`);
    const ok = await generateImage(char.prompt, path, '1024x1024');
    if (ok) success++;
  }
  console.log(`\nCharacters: ${success}/${entries.length} generated`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const category = args[0]; // 'locations', 'characters', or undefined (all)
const filter = args[1];   // specific id, or undefined (all in category)

(async () => {
  console.log('Mafia Game — Image Generation (GPT Image 1)');
  console.log('Style: Lovecraftian horror, 1920s coastal village\n');

  if (!category || category === 'locations') {
    await generateLocations(filter);
  }
  if (!category || category === 'characters') {
    await generateCharacters(filter);
  }

  console.log('\nDone! Images saved to public/images/');
})();
