import React from "react";
import { Composition } from "remotion";
import { MainComposition } from "./components/MainComposition";
import { ShortsComposition } from "./components/ShortsComposition";
import storyboardData from "./data/storyboard.json";
import shortsData from "./data/shorts.json";

const FPS = 30;

const totalDurationInFrames = Math.ceil(
    storyboardData.scenes.reduce(
        (acc: number, scene: { durationInSeconds: number }) => acc + scene.durationInSeconds,
        0
    ) * FPS
);

const shortsDurationInFrames = Math.ceil(
    (shortsData.scenes as { durationInSeconds: number }[]).reduce(
        (acc, scene) => acc + scene.durationInSeconds,
        0
    ) * FPS
);

const hasShortsScenes = (shortsData.scenes as { durationInSeconds: number }[]).length > 0;

export const Root: React.FC = () => {
    return (
        <>
            <Composition
                id="MainVideo"
                component={MainComposition}
                durationInFrames={totalDurationInFrames}
                fps={FPS}
                width={1920}
                height={1080}
                defaultProps={{}}
            />
            {hasShortsScenes ? (
                <Composition
                    id="ShortsVideo"
                    component={ShortsComposition}
                    durationInFrames={shortsDurationInFrames}
                    fps={FPS}
                    width={1080}
                    height={1920}
                    defaultProps={{}}
                />
            ) : null}
        </>
    );
};
