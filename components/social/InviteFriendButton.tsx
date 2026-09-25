import React from "react";
import { Text, TouchableOpacity, Share, TouchableOpacityProps } from "react-native";
import { Share2 } from "lucide-react-native";
import { useLeaderboardStore } from "../../store/social/leaderboardStore";

interface InviteFriendButtonProps extends TouchableOpacityProps {
  label?: string;
  iconSize?: number;
}

export function InviteFriendButton({ 
  label = "Invite Friends", 
  iconSize = 18,
  className = "",
  ...props 
}: InviteFriendButtonProps) {
  
  const handleInvite = async () => {
    try {
      const currentUserEntry = useLeaderboardStore.getState().currentUserEntry;
      const inviteMessage = `Join me on Replix and let's compete! 🏆\n\nMy username is: ${currentUserEntry?.name || "A fellow athlete"}\n\nDownload for Android: https://play.google.com/store/apps/details?id=com.skortan.replix\n(iOS App Store coming soon!)`;
      
      await Share.share({
        message: inviteMessage,
        title: 'Join me on Replix',
      });
    } catch (error) {
      console.log('Error sharing:', error);
    }
  };

  return (
    <TouchableOpacity
      onPress={handleInvite}
      className={`bg-[#2A2A2A] rounded-2xl flex-row items-center justify-center border border-white/10 ${className}`}
      {...props}
    >
      <Share2 size={iconSize} color="#E0E0E0" />
      <Text className="text-sm font-outfitBold text-[#E0E0E0] uppercase tracking-widest ml-3">
        {label}
      </Text>
    </TouchableOpacity>
  );
}
