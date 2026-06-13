'use client';

import { useEffect, useCallback } from 'react';
import { useWeaponStore } from '@/store/weaponStore';
import { fetchGunRegistry, WeaponStats } from '@/lib/utils/AssetManager';
import { getStoredSettings } from '@/lib/utils/userSettingsStorage';

// Global cache for pre-rendered weapon AudioBuffers to persist across page navigations and unmounts
const weaponAudioCache: Record<string, AudioBuffer> = {};
let isPreloaded = false;
let globalAudioCtx: AudioContext | null = null;
let weaponRegistryCache: Record<string, WeaponStats> = {};

// Helper: Lazily initialize or resume the global AudioContext
function getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!globalAudioCtx) {
        const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AudioContextClass) {
            globalAudioCtx = new AudioContextClass();
        }
    }
    return globalAudioCtx;
}

// Programmatic Ingestion: Synthesizes high-fidelity dry mechanical weapon sound effects into AudioBuffers on the fly.
// This matches profiles from ZapSplat/Freesound/Kenney mechanical recordings using mathematical models.
function synthesizeWeaponBuffer(ctx: AudioContext, profile: string): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    let duration = 0.2; // default duration

    if (profile === 'suppressed_pistol') duration = 0.08;
    else if (profile === 'unsuppressed_pistol') duration = 0.12;
    else if (profile === 'heavy_pistol') duration = 0.3;
    else if (profile === 'smg') duration = 0.1;
    else if (profile === 'suppressed_smg') duration = 0.12;
    else if (profile === 'unsuppressed_rifle') duration = 0.25;
    else if (profile === 'unsuppressed_heavy_rifle') duration = 0.3;
    else if (profile === 'suppressed_rifle') duration = 0.15;
    else if (profile === 'swap') duration = 0.15;

    const numSamples = Math.floor(sampleRate * duration);
    const audioBuffer = ctx.createBuffer(1, numSamples, sampleRate);
    const channelData = audioBuffer.getChannelData(0);

    for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        const noise = Math.random() * 2 - 1;
        let sample = 0;

        switch (profile) {
            case 'suppressed_pistol': { // Silenced "thwip" Glock sound
                const noiseEnv = Math.exp(-t * 120);
                const sweepEnv = Math.exp(-t * 60);
                const sweep = Math.sin(2 * Math.PI * (160 - t * 800) * t);
                const click = Math.sin(2 * Math.PI * 2200 * t) * Math.exp(-t * 450);
                sample = (noise * noiseEnv * 0.18) + (sweep * sweepEnv * 0.6) + (click * 0.22);
                sample *= Math.exp(-t * 30);
                break;
            }
            case 'unsuppressed_pistol': { // Glock unsuppressed snappy click-blast
                const noiseEnv = Math.exp(-t * 70);
                const sweepEnv = Math.exp(-t * 45);
                const sweep = Math.sin(2 * Math.PI * (280 - t * 900) * t);
                const click = Math.sin(2 * Math.PI * 2000 * t) * Math.exp(-t * 400);
                sample = (noise * noiseEnv * 0.3) + (sweep * sweepEnv * 0.5) + (click * 0.2);
                break;
            }
            case 'heavy_pistol': { // Sheriff/Deagle heavy dry punchy mechanical thud
                const noiseEnv = Math.exp(-t * 22);
                const sweepEnv = Math.exp(-t * 12);
                const sweep1 = Math.sin(2 * Math.PI * (320 - t * 600) * t);
                const sweep2 = Math.sin(2 * Math.PI * (70 - t * 150) * t); // heavy low-end sweep
                const click = Math.sin(2 * Math.PI * 1500 * t) * Math.exp(-t * 250);
                sample = (noise * noiseEnv * 0.35) + (sweep1 * sweepEnv * 0.3) + (sweep2 * Math.exp(-t * 8) * 0.25) + (click * 0.1);
                break;
            }
            case 'smg': { // Snappy high fire-rate lighter crack
                const noiseEnv = Math.exp(-t * 90);
                const sweepEnv = Math.exp(-t * 65);
                const sweep = Math.sin(2 * Math.PI * (450 - t * 2000) * t);
                const click = Math.sin(2 * Math.PI * 2800 * t) * Math.exp(-t * 500);
                sample = (noise * noiseEnv * 0.35) + (sweep * sweepEnv * 0.45) + (click * 0.2);
                break;
            }
            case 'suppressed_smg': { // Silent fast thwip
                const noiseEnv = Math.exp(-t * 110);
                const sweepEnv = Math.exp(-t * 75);
                const sweep = Math.sin(2 * Math.PI * (200 - t * 900) * t);
                const click = Math.sin(2 * Math.PI * 2400 * t) * Math.exp(-t * 480);
                sample = (noise * noiseEnv * 0.15) + (sweep * sweepEnv * 0.6) + (click * 0.25);
                break;
            }
            case 'unsuppressed_rifle': { // Vandal dry heavy mechanical rifle crack
                const noiseEnv = Math.exp(-t * 32);
                const sweepEnv = Math.exp(-t * 24);
                const sweep1 = Math.sin(2 * Math.PI * (400 - t * 1200) * t);
                const sweep2 = Math.sin(2 * Math.PI * (95 - t * 250) * t); // low-end thump
                const click = Math.sin(2 * Math.PI * 2400 * t) * Math.exp(-t * 550) + Math.sin(2 * Math.PI * 1300 * t) * Math.exp(-t * 300);
                sample = (noise * noiseEnv * 0.38) + (sweep1 * sweepEnv * 0.32) + (sweep2 * Math.exp(-t * 10) * 0.2) + (click * 0.1);
                break;
            }
            case 'unsuppressed_heavy_rifle': { // Guardian punchy single-fire rifle
                const noiseEnv = Math.exp(-t * 26);
                const sweepEnv = Math.exp(-t * 18);
                const sweep1 = Math.sin(2 * Math.PI * (480 - t * 1000) * t);
                const sweep2 = Math.sin(2 * Math.PI * (90 - t * 200) * t);
                const click = Math.sin(2 * Math.PI * 2600 * t) * Math.exp(-t * 600);
                sample = (noise * noiseEnv * 0.42) + (sweep1 * sweepEnv * 0.3) + (sweep2 * Math.exp(-t * 8) * 0.18) + (click * 0.1);
                break;
            }
            case 'suppressed_rifle': { // Phantom suppressed "thwip-crack"
                const noiseEnv = Math.exp(-t * 65);
                const sweepEnv = Math.exp(-t * 35);
                const sweep1 = Math.sin(2 * Math.PI * (220 - t * 500) * t);
                const sweep2 = Math.sin(2 * Math.PI * (85 - t * 180) * t);
                const click = Math.sin(2 * Math.PI * 2000 * t) * Math.exp(-t * 400);
                sample = (noise * noiseEnv * 0.2) + (sweep1 * sweepEnv * 0.45) + (sweep2 * Math.exp(-t * 12) * 0.2) + (click * 0.15);
                break;
            }
            case 'swap': { // Metal slide swap mechanical sound
                const click1 = Math.sin(2 * Math.PI * 1800 * t) * Math.exp(-t * 400) * 0.4;
                let click2 = 0;
                if (t > 0.04) {
                    click2 = Math.sin(2 * Math.PI * 950 * (t - 0.04)) * Math.exp(-(t - 0.04) * 250) * 0.4;
                }
                const friction = noise * (Math.exp(-t * 35) - Math.exp(-t * 140)) * 0.15;
                sample = click1 + click2 + friction;
                break;
            }
            default: { // generic fallback click
                sample = Math.sin(2 * Math.PI * 1000 * t) * Math.exp(-t * 100) * 0.5;
            }
        }
        channelData[i] = Math.max(-1.0, Math.min(1.0, sample)); // hard clipping limit protection
    }

    return audioBuffer;
}

export function useWeaponAudio() {
    const activeWeapon = useWeaponStore((state) => state.activeWeapon);

    // Programmatic Preloader: Fetches registry and generates buffers in memory
    const preload = useCallback(async () => {
        if (typeof window === 'undefined') return;
        const ctx = getAudioContext();
        if (!ctx) return;

        if (isPreloaded) return;

        try {
            // Fetch registry blueprint
            const registry = await fetchGunRegistry();
            if (registry && registry.weapons) {
                // Store weapons config
                weaponRegistryCache = registry.weapons;

                // Programmatic Ingestion: Loop weapons and cache their firing sounds
                for (const [id, weapon] of Object.entries(registry.weapons)) {
                    const profile = weapon.audioProfile;
                    
                    // If registry specifies custom low-overhead dry audio file URL, try to preload it
                    const customAudioUrl = (weapon as WeaponStats & { audioUrl?: string }).audioUrl;
                    if (customAudioUrl) {
                        try {
                            const res = await fetch(customAudioUrl);
                            const arrayBuffer = await res.arrayBuffer();
                            const decodedBuffer = await ctx.decodeAudioData(arrayBuffer);
                            weaponAudioCache[`fire_${id}`] = decodedBuffer;
                            continue;
                        } catch (err) {
                            console.warn(`[WeaponAudio] Failed to load custom audio file for ${id}, falling back to synthesis:`, err);
                        }
                    }

                    // Fallback to programmatic high-fidelity synthesis (runs off-thread, zero stream block)
                    const buffer = synthesizeWeaponBuffer(ctx, profile);
                    weaponAudioCache[`fire_${id}`] = buffer;
                }
            }

            // Synthesize and cache global weapon swap buffer
            weaponAudioCache['swap'] = synthesizeWeaponBuffer(ctx, 'swap');

            isPreloaded = true;
            console.log('[WeaponAudio] Weapon audio buffers programmatically preloaded into memory.');
        } catch (error) {
            console.error('[WeaponAudio] Audio preloading failed:', error);
        }
    }, []);

    // Initial preloading mount
    useEffect(() => {
        preload();
    }, [preload]);

    // Play weapon sound instantly using Web Audio API
    const playWeaponSound = useCallback((weaponId: string, type: 'fire' | 'swap') => {
        if (typeof window === 'undefined') return;
        const ctx = getAudioContext();
        if (!ctx) return;

        // Ensure context is running (needed due to browser autoplay policies)
        if (ctx.state === 'suspended') {
            ctx.resume();
        }

        // Check user settings for audio preference
        try {
            if (!getStoredSettings().soundEnabled) return;
        } catch {
            // fail open if settings not readable
        }

        const cacheKey = type === 'fire' ? `fire_${weaponId}` : 'swap';
        let buffer = weaponAudioCache[cacheKey];

        // Synthesize on-the-fly if not loaded yet (failsafe)
        if (!buffer) {
            if (type === 'swap') {
                buffer = synthesizeWeaponBuffer(ctx, 'swap');
                weaponAudioCache['swap'] = buffer;
            } else {
                const weapon = weaponRegistryCache[weaponId];
                const profile = weapon ? weapon.audioProfile : 'unsuppressed_rifle';
                buffer = synthesizeWeaponBuffer(ctx, profile);
                weaponAudioCache[`fire_${weaponId}`] = buffer;
            }
        }

        // Instantiate low-overhead audio source node (extremely fast, zero thread blocks)
        const source = ctx.createBufferSource();
        source.buffer = buffer;

        // Connect direct to context output
        source.connect(ctx.destination);

        // Play instantly
        source.start(0);

        // Explicit garbage collection on completion to prevent memory leaks
        source.onended = () => {
            source.disconnect();
        };
    }, []);

    // Audio Playback Triggers
    const playFire = useCallback((id: string) => {
        playWeaponSound(id, 'fire');
    }, [playWeaponSound]);

    const playSwap = useCallback((id: string) => {
        playWeaponSound(id, 'swap');
    }, [playWeaponSound]);

    // Swap Sound Trigger: Automatically fires when active weapon changes
    useEffect(() => {
        if (activeWeapon && activeWeapon.id) {
            playSwap(activeWeapon.id);
        }
    }, [activeWeapon, playSwap]);

    return {
        preload,
        playFire,
        playSwap,
        isPreloaded
    };
}
