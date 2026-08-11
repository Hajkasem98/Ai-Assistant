import * as SpeechSDK from "microsoft-cognitiveservices-speech-sdk"; // SM-Dev

async function getSpeechToken() {
    const base = import.meta.env.VITE_API_BASE_URL;
    const res = await fetch(`${base}/api/Chat/speech-token`);

    if (!res.ok) {
        throw new Error("Failed to fetch speech token")
    }

    const data = await res.json();
    console.log("Speech token response:", data);
    if (!data.token || data.token - length < 100) {
        throw new Error("Invalid token form backend");
    }
    return data;
}

// ---------- SPEECH TO TEXT ----------
export const speechToText = async (): Promise<string> => {
    const { token, region } = await getSpeechToken();

    return new Promise((resolve, reject) => {
        const speechConfig = SpeechSDK.SpeechConfig.fromAuthorizationToken(token, region);
        speechConfig.authorizationToken = token;

        speechConfig.speechRecognitionLanguage = "nb-NO"; // or en-US

        const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
        const recognizer = new SpeechSDK.SpeechRecognizer(
            speechConfig,
            audioConfig
        );

        recognizer.recognizeOnceAsync(
            (result) => {
                if (result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
                    resolve(result.text);
                } else {
                    reject(result.errorDetails);
                }
                recognizer.close();
            },
            (err) => {
                recognizer.close();
                reject(err);
            }
        );
    });
};

// ---------- TEXT TO SPEECH ----------
export const textToSpeech = async (text: string): Promise<string> => {

    const { token, region } = await getSpeechToken(); // speech key endpoint returns a token with speech key

    return new Promise((resolve, reject) => {

        const speechConfig = SpeechSDK.SpeechConfig.fromAuthorizationToken(token, region); // pulls speech key and region through the tokenization from the speech key endpoint
        speechConfig.authorizationToken = token;
        speechConfig.speechSynthesisVoiceName = "nb-NO-FinnNeural"; // Man's voice, Norwegian

        const audioConfig = null;
        const synthesizer = new SpeechSDK.SpeechSynthesizer(speechConfig, audioConfig);

        synthesizer.speakTextAsync(
            text,
            (result) => {
                if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
                    const blob = new Blob([result.audioData], { type: "audio/wav", });
                    const url = URL.createObjectURL(blob);
                    resolve(url);
                } else {
                    reject(result.errorDetails);
                }
                synthesizer.close();
            },
            (err) => {
                synthesizer.close();
                reject(err);
            }
        );
    });
};