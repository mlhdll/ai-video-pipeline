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
import storyboardData from "../data/storyboard.json";

interface WordTimestamp {
    word: string;
    start: number;
    end: number;
}

interface SceneData {
    id: string;
    type: string;
    durationInSeconds: number;
    narration: string;
    wordTimestamps?: WordTimestamp[];
    imageFile: string;
    audioFile: string;
    transition: string;
}

interface SceneProps {
    scene: SceneData;
    durationInFrames: number;
}

const DynamicSubtitles: React.FC<{ words: WordTimestamp[], fallbackText: string, fps: number, currentTime: number, opacity: number }> = ({ words, fallbackText, fps, currentTime, opacity }) => {
    if (!words || words.length === 0) {
        return (
            <div style={{ position: "absolute", bottom: 90, left: 0, right: 0, display: "flex", justifyContent: "center", opacity }}>
                <div style={{ backgroundColor: "rgba(0, 0, 0, 0.72)", borderRadius: 10, padding: "16px 40px", maxWidth: "75%", backdropFilter: "blur(6px)", border: "1px solid rgba(255,255,255,0.1)" }}>
                    <p style={{ color: "#FFFFFF", fontSize: 42, fontFamily: "'Inter', sans-serif", fontWeight: 500, textAlign: "center", lineHeight: 1.4, margin: 0 }}>
                        {fallbackText}
                    </p>
                </div>
            </div>
        );
    }

    const CHUNK_SIZE = 4;
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
            position: "absolute", bottom: 120, left: 0, right: 0,
            display: "flex", justifyContent: "center", alignItems: "center",
            flexWrap: "wrap", gap: "16px", padding: "0 60px",
            opacity
        }}>
            {activeChunk.map((w, i) => {
                const isActive = currentTime >= w.start && currentTime <= w.end;
                return (
                    <span key={i} style={{
                        color: "#F3F4F6",
                        backgroundColor: isActive ? "#8B5CF6" : "transparent",
                        padding: "6px 14px",
                        borderRadius: "12px",
                        fontSize: 58,
                        fontFamily: "'Inter', sans-serif",
                        fontWeight: 900,
                        textTransform: "uppercase",
                        textShadow: isActive ? "none" : "4px 4px 0px rgba(0,0,0,0.8)",
                        transform: isActive ? "scale(1.08)" : "scale(1)",
                        display: "inline-block",
                        boxShadow: isActive ? "0 8px 20px rgba(139, 92, 246, 0.5)" : "none",
                        willChange: "transform"
                    }}>
                        {w.word}
                    </span>
                );
            })}
        </div>
    );
};

const TRANSITION_FRAMES = 15;
const MUSIC_VOLUME = 0.06;

const SceneView: React.FC<SceneProps> = ({ scene, durationInFrames }) => {
    const { fps } = useVideoConfig();
    // Inside a <Sequence>, useCurrentFrame() returns the local (relative) frame
    const localFrame = useCurrentFrame();

    const scale = interpolate(localFrame, [0, durationInFrames], [1.0, 1.06], {
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

    const isCard = scene.type === "endCard" || scene.type === "titleCard";

    return (
        <AbsoluteFill style={{ backgroundColor: "#000", overflow: "hidden" }}>
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
                        background: "linear-gradient(135deg, #0a0a2e 0%, #1a1a4e 100%)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <p
                        style={{
                            color: "#FFD700",
                            fontSize: 72,
                            fontFamily: "'Inter', sans-serif",
                            fontWeight: 700,
                            textAlign: "center",
                            textShadow: "0 0 30px rgba(255,215,0,0.5)",
                            letterSpacing: "0.05em",
                            margin: 0,
                            padding: "0 80px",
                        }}
                    >
                        {scene.narration}
                    </p>
                </AbsoluteFill>
            )}

            {!isCard && scene.narration && (
                <DynamicSubtitles 
                    words={scene.wordTimestamps || []} 
                    fallbackText={scene.narration} 
                    fps={fps} 
                    currentTime={localFrame / fps}
                    opacity={interpolate(localFrame, [TRANSITION_FRAMES, TRANSITION_FRAMES + 10], [0, 1], {
                        extrapolateLeft: "clamp",
                        extrapolateRight: "clamp",
                    })}
                />
            )}

            {/* Audio scoped to this Sequence — starts at frame 0 of this scene */}
            {scene.audioFile && (
                <Audio src={staticFile(`assets/audios/${scene.audioFile}`)} volume={1} />
            )}
        </AbsoluteFill>
    );
};

export const MainComposition: React.FC = () => {
    const { fps } = useVideoConfig();
    const scenes: SceneData[] = storyboardData.scenes as SceneData[];

    let cumulative = 0;
    const scenesWithFrames = scenes.map((scene) => {
        const startFrame = cumulative;
        const durationInFrames = Math.ceil(scene.durationInSeconds * fps);
        cumulative += durationInFrames;
        return { scene, startFrame, durationInFrames };
    });

    return (
        <AbsoluteFill style={{ backgroundColor: "#000" }}>
            {/* Persistent looping background music at low volume */}
            {storyboardData.musicFile && (
                <Audio
                    src={staticFile(`assets/audios/${storyboardData.musicFile}`)}
                    volume={MUSIC_VOLUME}
                    loop
                />
            )}

            {/* Each scene in its own Sequence for correct audio timing */}
            {scenesWithFrames.map(({ scene, startFrame, durationInFrames }) => (
                <Sequence
                    key={scene.id}
                    from={startFrame}
                    durationInFrames={durationInFrames}
                >
                    <SceneView scene={scene} durationInFrames={durationInFrames} />
                </Sequence>
            ))}
        </AbsoluteFill>
    );
};
