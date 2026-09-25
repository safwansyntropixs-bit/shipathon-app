// components/ErrorBoundary.tsx
import React from "react";
import { Text, View } from "react-native";

interface Props {
    children: React.ReactNode;
}
interface State {
    error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error: Error) {
        return { error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error("Caught crash:", error, info);
    }

    render() {
        if (this.state.error) {
            return (
                <View style={{ flex: 1, backgroundColor: "black", padding: 20, paddingTop: 80 }}>
                    <Text style={{ color: "red", fontSize: 16, fontWeight: "bold", marginBottom: 12 }}>
                        Camera Crash Caught:
                    </Text>
                    <Text style={{ color: "white", fontSize: 13 }}>
                        {this.state.error.message}
                    </Text>
                    <Text style={{ color: "#888", fontSize: 11, marginTop: 12 }}>
                        {this.state.error.stack}
                    </Text>
                </View>
            );
        }
        return this.props.children;
    }
}