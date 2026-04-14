const mongoose = require('mongoose');
const SafetyScore = require('../models/SafetyScore');
require('dotenv').config({ path: '../.env' });

// 25 real streets, localities & landmarks INSIDE Vellore town
// riskLevel derived from score:  >=70 safe (green) | 45-69 medium (orange) | <45 danger (red)
const seeds = [
  // ── Red / High-risk (score < 45) ──────────────────────────────────────
  { locationName: 'Long Bazaar Street',          lat: 12.9215, lng: 79.1330, score: 32, incidents: 16, lighting: 1, crowd: 'high'   },
  { locationName: 'VOC Street',                  lat: 12.9180, lng: 79.1300, score: 36, incidents: 14, lighting: 1, crowd: 'high'   },
  { locationName: 'Oduvar Street',               lat: 12.9190, lng: 79.1360, score: 38, incidents: 13, lighting: 2, crowd: 'medium' },
  { locationName: 'Palar Riverfront Road',       lat: 12.9120, lng: 79.1290, score: 30, incidents: 18, lighting: 1, crowd: 'low'    },
  { locationName: 'Thottapalayam Main Road',     lat: 12.9010, lng: 79.1350, score: 34, incidents: 15, lighting: 1, crowd: 'low'    },
  { locationName: 'Viruthampet Street',          lat: 12.9100, lng: 79.1460, score: 40, incidents: 11, lighting: 2, crowd: 'medium' },
  { locationName: 'Scudder Road',                lat: 12.9260, lng: 79.1340, score: 42, incidents: 10, lighting: 2, crowd: 'high'   },

  // ── Orange / Medium-risk (score 45–69) ────────────────────────────────
  { locationName: 'Ida Scudder Road',            lat: 12.9248, lng: 79.1365, score: 58, incidents: 5,  lighting: 3, crowd: 'medium' },
  { locationName: 'Mission Road',                lat: 12.9230, lng: 79.1340, score: 54, incidents: 6,  lighting: 3, crowd: 'medium' },
  { locationName: 'Arcot Road',                  lat: 12.9370, lng: 79.1300, score: 52, incidents: 7,  lighting: 3, crowd: 'medium' },
  { locationName: 'Bagayam Road',                lat: 12.9370, lng: 79.1610, score: 61, incidents: 4,  lighting: 3, crowd: 'medium' },
  { locationName: 'Kosapet Main Street',         lat: 12.9240, lng: 79.1420, score: 50, incidents: 7,  lighting: 3, crowd: 'medium' },
  { locationName: 'Palavansathu Road',           lat: 12.9320, lng: 79.1600, score: 63, incidents: 4,  lighting: 3, crowd: 'medium' },
  { locationName: 'Ariyur Cross Street',         lat: 12.9450, lng: 79.1750, score: 56, incidents: 6,  lighting: 3, crowd: 'medium' },
  { locationName: 'Ponnai Road',                 lat: 12.9560, lng: 79.1420, score: 60, incidents: 5,  lighting: 3, crowd: 'medium' },
  { locationName: 'Gandhi Nagar 1st Street',     lat: 12.9055, lng: 79.1400, score: 62, incidents: 4,  lighting: 3, crowd: 'medium' },
  { locationName: 'Officers Line Road',          lat: 12.9230, lng: 79.1310, score: 65, incidents: 3,  lighting: 4, crowd: 'medium' },
  { locationName: 'Katpadi Main Road',           lat: 12.9784, lng: 79.1478, score: 48, incidents: 8,  lighting: 2, crowd: 'medium' },

  // ── Green / Safe (score >= 70) ────────────────────────────────────────
  { locationName: 'VIT Main Road',               lat: 12.9716, lng: 79.1560, score: 85, incidents: 0,  lighting: 5, crowd: 'high'   },
  { locationName: 'Sathuvachari 2nd Street',     lat: 12.9612, lng: 79.1700, score: 74, incidents: 2,  lighting: 4, crowd: 'medium' },
  { locationName: 'Alamelumangapuram Street',    lat: 12.9390, lng: 79.1480, score: 70, incidents: 2,  lighting: 4, crowd: 'medium' },
  { locationName: 'Jalakandeswarar Koil Street', lat: 12.9204, lng: 79.1316, score: 78, incidents: 1,  lighting: 4, crowd: 'high'   },
  { locationName: 'CMC Hospital Road',           lat: 12.9248, lng: 79.1352, score: 80, incidents: 1,  lighting: 4, crowd: 'high'   },
  { locationName: 'Fort Road',                   lat: 12.9202, lng: 79.1318, score: 76, incidents: 1,  lighting: 4, crowd: 'high'   },
  { locationName: 'Vellore District Park Road',  lat: 12.9215, lng: 79.1350, score: 72, incidents: 2,  lighting: 4, crowd: 'medium' },
];

// derive riskLevel + all marker display fields from score, crowd, lighting
// valid riskTags enum: 'harassment-prone' | 'stalking-prone' | 'poor-lighting' | 'isolated'
//
// marker fields used by frontend L.divIcon circles:
//   glowColor  - hex fill + glow colour
//   pulseSpeed - CSS animation duration (fast = urgent, slow = calm)
//   markerSize - circle diameter in px
function getRiskMeta(score, crowd, lighting) {

  if (score >= 70) return {
    riskLevel:  'safe',
    glowColor:  '#22c55e',
    pulseSpeed: '2.8s',
    markerSize: 38,
    riskTags:   [],
  };

  if (score >= 45) {
    const tags = ['harassment-prone'];
    if (lighting <= 2) tags.push('poor-lighting');
    return {
      riskLevel:  'medium',
      glowColor:  '#f97316',
      pulseSpeed: '2.2s',
      markerSize: 42,
      riskTags:   tags,
    };
  }

  // danger - fastest pulse, biggest circle
  const tags = ['harassment-prone', 'poor-lighting'];
  if (crowd === 'low') tags.push('isolated');
  if (lighting === 1)  tags.push('stalking-prone');
  return {
    riskLevel:  'danger',
    glowColor:  '#ef4444',
    pulseSpeed: '1.8s',
    markerSize: 46,
    riskTags:   [...new Set(tags)],
  };
}

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  await SafetyScore.deleteMany({});

  const docs = seeds.map(s => {
    const { riskLevel, glowColor, pulseSpeed, markerSize, riskTags } = getRiskMeta(s.score, s.crowd, s.lighting);
    return {
      locationName:   s.locationName,
      coordinates:    { lat: s.lat, lng: s.lng },
      score:          s.score,
      incidentCount:  s.incidents,
      lightingRating: s.lighting,
      crowdDensity:   s.crowd,
      riskLevel,     // 'safe' | 'medium' | 'danger'
      glowColor,     // hex colour for the pulsing marker circle
      pulseSpeed,    // CSS animation duration e.g. '1.8s'
      markerSize,    // circle diameter in px e.g. 46
      lastIncidentAt: s.incidents === 0
        ? null
        : new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      riskTags,
    };
  });

  await SafetyScore.insertMany(docs);

  const red    = docs.filter(d => d.riskLevel === 'danger').length;
  const orange = docs.filter(d => d.riskLevel === 'medium').length;
  const green  = docs.filter(d => d.riskLevel === 'safe').length;

  console.log(`Seeded ${docs.length} Vellore locations`);
  console.log(`  Red    (danger) : ${red}`);
  console.log(`  Orange (medium) : ${orange}`);
  console.log(`  Green  (safe)   : ${green}`);
  process.exit(0);
}

seed();