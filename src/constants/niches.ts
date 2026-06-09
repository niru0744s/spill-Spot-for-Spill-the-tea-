/**
 * constants/niches.ts
 * --------------------
 * Single source of truth for all niche-related data used across:
 *   - (onboarding)/niches.tsx        — niche selection screen
 *   - components/EditNichesSheet.tsx  — edit niches bottom sheet
 *   - (tabs)/explore.tsx             — news feed keyword mapping
 *
 * Previously each file defined its own copy of this data.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NicheItem {
  /** Display label — also used as the key in user.niches[] in Firestore */
  label: string;
  /** Decorative emoji shown on pills and feed cards */
  emoji: string;
  /** Thematic cluster for grouping (shown in onboarding) */
  cluster: string;
}

// ---------------------------------------------------------------------------
// Master niche list (20 items, 5 clusters)
// ---------------------------------------------------------------------------

export const NICHES: NicheItem[] = [
  { label: 'Astrology',        emoji: '✨', cluster: 'Vibes'       },
  { label: 'Manifestation',    emoji: '🌙', cluster: 'Vibes'       },
  { label: 'Tarot',            emoji: '🔮', cluster: 'Vibes'       },
  { label: 'Fashion',          emoji: '👗', cluster: 'Aesthetics'  },
  { label: 'Beauty & Skincare',emoji: '💄', cluster: 'Aesthetics'  },
  { label: 'Thrift Flips',     emoji: '🛍️', cluster: 'Aesthetics'  },
  { label: 'Drama & Tea',      emoji: '🍵', cluster: 'Social'      },
  { label: 'Campus Life',      emoji: '🎓', cluster: 'Social'      },
  { label: 'Situationships',   emoji: '💔', cluster: 'Social'      },
  { label: 'K-Pop & K-Drama',  emoji: '🎵', cluster: 'Pop Culture' },
  { label: 'Anime',            emoji: '⛩️', cluster: 'Pop Culture' },
  { label: 'Gaming',           emoji: '🎮', cluster: 'Pop Culture' },
  { label: 'True Crime',       emoji: '🔍', cluster: 'Pop Culture' },
  { label: 'Mental Health',    emoji: '🧠', cluster: 'Wellness'    },
  { label: 'Gym & Fitness',    emoji: '💪', cluster: 'Wellness'    },
  { label: 'Food & Recipes',   emoji: '🍜', cluster: 'Wellness'    },
  { label: 'Travel',           emoji: '✈️', cluster: 'Wellness'    },
  { label: 'Entrepreneurship', emoji: '🚀', cluster: 'Career'      },
  { label: 'Tech & AI',        emoji: '💻', cluster: 'Career'      },
  { label: 'Art & Creativity', emoji: '🎨', cluster: 'Career'      },
];

// ---------------------------------------------------------------------------
// GNews keyword mapping (used by the Explore feed)
// ---------------------------------------------------------------------------

/** Maps each niche label to a GNews search query string */
export const NICHE_KEYWORDS: Record<string, string> = {
  'Astrology':         'astrology horoscope',
  'Manifestation':     'manifestation mindfulness',
  'Tarot':             'tarot spirituality',
  'Fashion':           'fashion trends style',
  'Beauty & Skincare': 'skincare beauty makeup',
  'Thrift Flips':      'thrift vintage fashion',
  'Drama & Tea':       'celebrity gossip drama',
  'Campus Life':       'college university student',
  'Situationships':    'dating relationships gen z',
  'K-Pop & K-Drama':  'kpop kdrama',
  'Anime':             'anime manga',
  'Gaming':            'gaming esports video games',
  'True Crime':        'true crime mystery crime',
  'Mental Health':     'mental health wellness anxiety',
  'Gym & Fitness':     'fitness gym workout exercise',
  'Food & Recipes':    'food recipes cooking',
  'Travel':            'travel destinations adventure',
  'Entrepreneurship':  'startup entrepreneurship business',
  'Tech & AI':         'artificial intelligence technology',
  'Art & Creativity':  'art design creativity',
};

/** Flat list of all niche labels — derived from NICHE_KEYWORDS */
export const ALL_NICHES = Object.keys(NICHE_KEYWORDS);

/** Quick emoji lookup by niche label */
export const NICHE_EMOJI: Record<string, string> = Object.fromEntries(
  NICHES.map((n) => [n.label, n.emoji])
);
