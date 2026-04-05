import React from "react";
import {
    AbsoluteFill,
    Audio,
    Img,
    Sequence,
    interpolate,
    staticFile,
    useCurrentFrame,
    useVideoConfig,
} from "remotion";
import shortsData from "../data/shorts.json";

interface WordTimestamp {
    word: string;
    start: number;
    end: number;
}

interface ShortScene {
    id: string;
    type: string;
    durationInSeconds: number;
    narration: string;
    wordTimestamps?: WordTimestamp[];
    imageFile: string;
    audioFile: string;
    showCTA?: boolean;
}

const DynamicShortsSubtitles: React.FC<{ words: WordTimestamp[], fallbackText: string, fps: number, currentTime: number, opacity: number }> = ({ words, fallbackText, fps, currentTime, opacity }) => {
    if (!words || words.length === 0) {
        return (
            <div style={{ position: "absolute", bottom: 180, left: 0, right: 0, padding: "0 40px", display: "flex", justifyContent: "center", opacity }}>
                <p style={{ color: "#FFFFFF", fontSize: 48, fontFamily: "'Inter', sans-serif", fontWeight: 600, textAlign: "center", lineHeight: 1.4, margin: 0, textShadow: "0 2px 12px rgba(0,0,0,0.9)" }}>
                    {fallbackText}
                </p>
            </div>
        );
    }

    const CHUNK_SIZE = 3; // Shorts usually have tighter text chunks
    const chunks: WordTimestamp[][] = [];
    for (let i = 0; i < words.length; i += CHUNK_SIZE) {
        chunks.push(words.slice(i, i + CHUNK_SIZE));
    }

    const activeChunkIndex = chunks.findIndex((chunk, idx) => {
        const isAfterStart = currentTime >= chunk[0].start;
        const isBeforeNext = idx === chunks.length - 1 ? true : currentTime < chunks[idx + 1][0].start;
        return isAfterStart && isBeforeNext;
    });

    const activeChunk = activeChunkIndex !== -1 ? chunks[activeChunkIndex] : null;

    if (!activeChunk) return null;

    return (
        <div style={{
            position: "absolute", bottom: 220, left: 0, right: 0,
            display: "flex", justifyContent: "center", alignItems: "center",
            flexWrap: "wrap", gap: "18px", padding: "0 40px",
            opacity
        }}>
            {activeChunk.map((w, i) => {
                const isActive = currentTime >= w.start && currentTime <= w.end;
                return (
                    <span key={i} style={{
                        color: "#F3F4F6",
                        backgroundColor: isActive ? "#8B5CF6" : "transparent",
                        padding: "8px 18px",
                        borderRadius: "16px",
                        fontSize: 62,
                        fontFamily: "'Inter', sans-serif",
                        fontWeight: 900,
                        textTransform: "uppercase",
                        textShadow: isActive ? "none" : "5px 5px 0px rgba(0,0,0,0.9)",
                        transform: isActive ? "scale(1.1)" : "scale(1)",
                        display: "inline-block",
                        boxShadow: isActive ? "0 12px 30px rgba(139, 92, 246, 0.6)" : "none",
                        willChange: "transform"
                    }}>
                        {w.word}
                    </span>
                );
            })}
        </div>
    );
};

const TRANSITION_FRAMES = 12;
const MUSIC_VOLUME = 0.05;

const ShortSceneView: React.FC<{ scene: ShortScene; durationInFrames: number }> = ({
    scene,
    durationInFrames,
}) => {
    const { fps } = useVideoConfig();
    const localFrame = useCurrentFrame();

    const scale = interpolate(localFrame, [0, durationInFrames], [1.0, 1.08], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
    });

    const fadeIn = interpolate(localFrame, [0, TRANSITION_FRAMES], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
    });

    const fadeOut = interpolate(
        localFrame,
        [durationInFrames - TRANSITION_FRAMES, durationInFrames],
        [1, 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );

    const opacity = Math.min(fadeIn, fadeOut);

    const subtitleOpacity = interpolate(
        localFrame,
        [TRANSITION_FRAMES, TRANSITION_FRAMES + 10],
        [0, 1],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );

    const ctaOpacity = interpolate(
        localFrame,
        [durationInFrames - 60, durationInFrames - 20],
        [0, 1],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );

    const isCard = scene.type === "endCard" || scene.type === "titleCard";

    return (
        <AbsoluteFill style={{ backgroundColor: "#000", overflow: "hidden" }}>
            {/* Background image — objectFit cover auto center-crops 16:9 to 9:16 */}
            {!isCard ? (
                <AbsoluteFill
                    style={{
                        opacity,
                        transform: `scale(${scale})`,
                        transformOrigin: "center center",
                    }}
                >
                    <Img
                        src={staticFile(`assets/images/${scene.imageFile}`)}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                </AbsoluteFill>
            ) : (
                <AbsoluteFill
                    style={{
                        opacity,
                        background: "linear-gradient(160deg, #0a0a2e 0%, #1a1a4e 100%)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexDirection: "column",
                        gap: 40,
                    }}
                >
                    <p style={{
                        color: "#FFD700",
                        fontSize: 64,
                        fontFamily: "'Inter', sans-serif",
                        fontWeight: 800,
                        textAlign: "center",
                        textShadow: "0 0 40px rgba(255,215,0,0.6)",
                        margin: 0,
                        padding: "0 60px",
                        lineHeight: 1.3,
                    }}>
                        {scene.narration}
                    </p>
                </AbsoluteFill>
            )}

            {/* Dark gradient at bottom for text readability */}
            <AbsoluteFill
                style={{
                    background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 40%)",
                    opacity,
                }}
            />

            {/* Subtitle narration */}
            {!isCard && scene.narration && (
                <DynamicShortsSubtitles
                    words={scene.wordTimestamps || []}
                    fallbackText={scene.narration}
                    fps={fps}
                    currentTime={localFrame / fps}
                    opacity={subtitleOpacity}
                />
            )}

            {/* CTA on last scene */}
            {scene.showCTA && (
                <div style={{
                    position: "absolute",
                    bottom: 60,
                    left: 0,
                    right: 0,
                    display: "flex",
                    justifyContent: "center",
                    opacity: ctaOpacity,
                }}>
                    <div style={{
                        backgroundColor: "#FF0000",
                        borderRadius: 50,
                        padding: "20px 60px",
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                    }}>
                        <p style={{
                            color: "#FFFFFF",
                            fontSize: 42,
                            fontFamily: "'Inter', sans-serif",
                            fontWeight: 800,
                            margin: 0,
                            letterSpacing: "0.02em",
                        }}>
                            Watch Full Story ↓
                        </p>
                    </div>
                </div>
            )}

            {/* Channel branding top */}
            <div style={{
                position: "absolute",
                top: 60,
                left: 0,
                right: 0,
                display: "flex",
                justifyContent: "center",
                opacity: opacity * 0.9,
            }}>
                <p style={{
                    color: "rgba(255,255,255,0.7)",
                    fontSize: 32,
                    fontFamily: "'Inter', sans-serif",
                    fontWeight: 700,
                    letterSpacing: "0.15em",
                    textTransform: "uppercase",
                    margin: 0,
                    textShadow: "0 1px 8px rgba(0,0,0,0.8)",
                }}>
                    [YOUR_BRAND_NAME]
                </p>
            </div>

            {/* Audio */}
            {scene.audioFile && (
                <Audio src={staticFile(`assets/audios/${scene.audioFile}`)} volume={1} />
            )}
        </AbsoluteFill>
    );
};

export const ShortsComposition: React.FC = () => {
    const { fps } = useVideoConfig();
    const scenes = shortsData.scenes as ShortScene[];

    let cumulative = 0;
    const scenesWithFrames = scenes.map((scene) => {
        const startFrame = cumulative;
        const durationInFrames = Math.ceil(scene.durationInSeconds * fps);
        cumulative += durationInFrames;
        return { scene, startFrame, durationInFrames };
    });

    return (
        <AbsoluteFill style={{ backgroundColor: "#000" }}>
            {shortsData.musicFile && (
                <Audio
                    src={staticFile(`assets/audios/${shortsData.musicFile}`)}
                    volume={MUSIC_VOLUME}
                    loop
                />
            )}

            {scenesWithFrames.map(({ scene, startFrame, durationInFrames }) => (
                <Sequence
                    key={scene.id + "-short"}
                    from={startFrame}
                    durationInFrames={durationInFrames}
                >
                    <ShortSceneView scene={scene} durationInFrames={durationInFrames} />
                </Sequence>
            ))}
        </AbsoluteFill>
    );
};
