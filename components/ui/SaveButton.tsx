import { Check } from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity } from 'react-native';

interface SaveButtonProps {
  isSaving: boolean;
  isSaved: boolean;
  hasChanges: boolean;
  onPress: () => void;
  defaultText?: string;
  savingText?: string;
  savedText?: string;
  variant?: 'bar' | 'fab';
  className?: string;
}

export function SaveButton({
  isSaving,
  isSaved,
  hasChanges,
  onPress,
  defaultText = "Save Changes",
  savingText = "Saving...",
  savedText = "Saved",
  variant = "bar",
  className = "",
}: SaveButtonProps) {
  if (variant === "fab") {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        disabled={!hasChanges || isSaved || isSaving}
        className={`w-14 h-14 rounded-full items-center justify-center shadow-2xl shadow-black/80 ${isSaved
          ? "bg-[#3A9E66]/90 border border-[#4ADE80]/40 shadow-[#3A9E66]/40"
          : !hasChanges
            ? "bg-[#222226] border-[1.5px] border-white/20"
            : "bg-[#3A9E66] border border-[#4ADE80]/50 shadow-[#3A9E66]/60"
          } ${className}`}
        style={{ elevation: 8 }}
      >
        {isSaving ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <Check
            size={24}
            color={!hasChanges ? "rgba(255,255,255,0.45)" : "#FFFFFF"}
            strokeWidth={2.5}
          />
        )}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      disabled={!hasChanges || isSaved || isSaving}
      className={`w-full h-11 rounded-xl flex-row items-center justify-center shadow-lg ${isSaved
        ? "bg-[#3A9E66]/80"
        : !hasChanges
          ? "bg-white/10"
          : "bg-[#3A9E66]"
        } ${className}`}
    >
      {isSaving ? (
        <ActivityIndicator color="#FFFFFF" size="small" />
      ) : (
        <Check size={16} color={!hasChanges ? "#FFFFFF50" : "#FFFFFF"} />
      )}
      <Text
        className={`font-outfitBold text-xs uppercase tracking-wider ml-2 ${!hasChanges && !isSaved ? "text-white/50" : "text-white"
          }`}
      >
        {isSaving ? savingText : isSaved ? savedText : defaultText}
      </Text>
    </TouchableOpacity>
  );
}
