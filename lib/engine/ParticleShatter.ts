/**
 * ParticleShatter.ts
 * 
 * A high-performance 2D Canvas-based particle shatter system.
 * It uses the generic ObjectPool to recycle particle entities, eliminating allocations.
 * Spawns low-poly debris shards that fly outward from a hit target under gravity.
 */
import { ObjectPool } from './ObjectPool';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  decay: number;
  angle: number;
  spin: number;
  sides: number;
}

export class ParticleShatterSystem {
  private pool: ObjectPool<Particle>;
  private gravity: number;

  constructor(maxParticles: number = 200, gravity: number = 800) {
    this.gravity = gravity;

    // Factory function to create clean particle structures
    const factory = (): Particle => ({
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      color: '#3366FF',
      size: 0,
      life: 0,
      decay: 0,
      angle: 0,
      spin: 0,
      sides: 3,
    });

    // Reset function called when releasing particle back to the pool
    const reset = (p: Particle) => {
      p.x = 0;
      p.y = 0;
      p.vx = 0;
      p.vy = 0;
      p.life = 0;
    };

    this.pool = new ObjectPool<Particle>(factory, maxParticles, maxParticles, reset);
  }

  /**
   * Spawns a burst of low-poly debris shards at coordinates (x, y)
   */
  spawnShatter(x: number, y: number, color: string, count: number = 12) {
    for (let i = 0; i < count; i++) {
      const p = this.pool.acquire();
      if (!p) break; // Pool limit reached

      p.x = x;
      p.y = y;

      // Random direction and speed
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 250 + 100; // 100-350 pixels per second
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed - 100; // Upward initial bias

      p.color = color;
      p.size = Math.random() * 6 + 3; // 3px to 9px size
      p.life = 1.0; // Start fully alive
      p.decay = Math.random() * 1.5 + 1.2; // Lifetime ~0.4s to 0.8s
      p.angle = Math.random() * Math.PI * 2;
      p.spin = (Math.random() - 0.5) * 10; // Rotation speed
      p.sides = Math.floor(Math.random() * 3) + 3; // 3 to 5 sides (triangles, quads, pentagons)
    }
  }

  /**
   * Updates physics and draws particles. Recycles particles when they die.
   */
  updateAndDraw(ctx: CanvasRenderingContext2D, delta: number) {
    const activeParticles = this.pool.getActive();
    // Copy active list to iterate safely since releasing modifies the active array internally
    const particlesToUpdate = [...activeParticles];

    for (let i = 0; i < particlesToUpdate.length; i++) {
      const p = particlesToUpdate[i];

      // Gravity step and kinematic updates
      p.vy += this.gravity * delta;
      p.x += p.vx * delta;
      p.y += p.vy * delta;
      p.angle += p.spin * delta;
      p.life -= p.decay * delta;

      // Recycle dead particles
      if (p.life <= 0) {
        this.pool.release(p);
        continue;
      }

      // Draw the low-poly shard shape
      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1;

      ctx.beginPath();
      // Draw standard regular polygon based on sides
      const shardRadius = p.size;
      const startX = p.x + shardRadius * Math.cos(p.angle);
      const startY = p.y + shardRadius * Math.sin(p.angle);
      ctx.moveTo(startX, startY);

      for (let s = 1; s < p.sides; s++) {
        const theta = p.angle + (s * Math.PI * 2) / p.sides;
        ctx.lineTo(p.x + shardRadius * Math.cos(theta), p.y + shardRadius * Math.sin(theta));
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  /**
   * Resets and clears all active particles (e.g., on session restart/cleanup)
   */
  reset() {
    this.pool.releaseAll();
  }
}
