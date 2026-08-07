# Velocity Trails (TechChase 2K26)

Velocity Trails is a 3-level hybrid elimination game designed for TechChase 2K26.

## Game Structure

### Level 1: Scavenger Hunt (Physical + Web Hybrid)
**Theme**: Real-world exploration and decoding.
**Format**: Web-based Timer & Validation system.
- Players begin by authenticating via the main terminal (`index.html`). They receive an AG_ID.
- The web app starts a background timer.
- Players physically search the designated classroom/arena to find hidden clues and materials.
- Players must piece together the clues to form a Master Code, which they enter into the system.
- **Rule**: Every player competes individually. The time limit to complete this level is **3 minutes**. if exceeds then get negative points for every 15 seconds.
- **Outcome**: Players progress to Level 2.

### Level 2: Trial Run (3D Unity Game - *Currently prototyped in Canvas*)
**Theme**: Fast-paced hazard dodging and collection.
**Format**: 3D Level Game built in Unity.
- Qualified players enter a **multiplayer environment** where everyone plays in the same shared world.
- Players start with **3 lives**. if all lives lost then eliminated
- **Objective**: Everyone has to find and collect their 3 Velocity Crystals. Each player will have a **Navigator** to help them find the lost crystals.
- Players must avoid hazards (Robots, Lasers, Viruses). Each hit costs 1 life. Losing all 3 lives results in immediate elimination.
- **Rule**: The time limit to complete this level is **3 minutes**. level 1 negative and time exceeds 1 then eliminated 
- **Outcome**: Players earn Leaderboard Points based on their completion speed. 

### Level 3: Astra's Core (3D Unity Boss Fight - *Currently prototyped in Canvas*)
**Theme**: The Final Showdown against the Corrupted Overlord.
**Format**: 3D Level Game built in Unity.
- The final 2 players play **individually** against the boss. 
- They select their weapon (Shadow Sword, Gravity Blaster, or Elemental Spear).
- They battle the Boss, attempting to deal as much damage as possible while dodging counter-attacks.
- **Rule**: The Boss in this level is stronger and fights alongside a **pet**. The time limit for the boss fight is **4 minutes**.
- **Outcome**: Points are awarded based on Boss HP damage dealt. 
- **Victory**: The player with the highest total Leaderboard Score across all 3 levels wins the game and Reboots Humanity.

---

## Technical Stack
- **Frontend**: HTML5, CSS3, Vanilla JS (Currently implementing Three.js & Anime.js prototypes for the 3D levels).
- **Backend**: Node.js, Express, SQLite, Prisma ORM. 
- *Note: Levels 2 and 3 will be migrated to Unity in the future, with the backend serving as the central authentication and leaderboard system.*
