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
- **Backend**: Node.js, Express, PostgreSQL, Prisma ORM. 
- *Note: Levels 2 and 3 will be migrated to Unity in the future, with the backend serving as the central authentication and leaderboard system.*

---

## Deploying to Render.com

This project is configured for a **1-click deployment** to Render using the included `render.yaml` Blueprint. The deployment includes a Node.js web server and a free PostgreSQL database.

### Step-by-Step Deployment Guide

**1. Create a Render Account**
- Go to [Render.com](https://dashboard.render.com/) and create a free account using your GitHub login.

**2. Create a New Blueprint**
- Once logged in, click the **New** button in the top-right corner.
- Select **Blueprint** from the dropdown menu.

**3. Connect Your Repository**
- Render will ask you to connect your GitHub account. Give it permission to view your repositories.
- Select your `velocity_trails` repository from the list.

**4. Deploy!**
- Render will automatically detect the `render.yaml` file in the root of your repository.
- You will see a summary showing that it will create a **Web Service** (`velocity-trails-backend`) and a **PostgreSQL Database** (`velocity-trails-db`).
- Click **Apply** or **Deploy**.

### What happens during deployment?
Render will automatically handle everything for you:
1. It spins up the free PostgreSQL database.
2. It installs the backend Node.js dependencies (`npm install`).
3. It pushes the database schema to PostgreSQL (`npx prisma db push`).
4. It seeds the database with initial configurations (`npm run seed`).
5. It starts the backend server on Port 4000.

### Accessing your Live Backend & Dashboard
Once the deployment finishes, Render will provide a public URL (e.g., `https://velocity-trails-backend.onrender.com`).
- Your backend API will be live at that URL.
- You can access the live **Admin Dashboard** at `https://velocity-trails-backend.onrender.com/dashboard`. The auto-generated password is `velocity2k26`.

### Local Development Note
If you want to run the backend locally on your computer after migrating to PostgreSQL, you will need to have a local PostgreSQL server running, or you can temporarily change `provider = "postgresql"` back to `provider = "sqlite"` in `Backend/prisma/schema.prisma` for local testing.
