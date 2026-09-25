import { decode } from "base64-arraybuffer";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { ArrowLeft, AtSign, CheckCircle, Upload, User as UserIcon, XCircle } from 'lucide-react-native';
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from "react-native";
import Toast from "react-native-toast-message";
import { PremiumAmbientBackground } from "../../components/layout/PremiumAmbientBackground";
import { ConfirmationModal } from "../../components/modals/ConfirmationModal";
import { UserAvatar } from "../../components/ui/UserAvatar";
import { SaveButton } from "../../components/ui/SaveButton";
import { CountrySelectModal } from "../../components/modals/CountrySelectModal";
import { COUNTRIES } from "../../constants/countries";
import { Globe } from "lucide-react-native";
import { usernameService } from "../../services/user/usernameService";
import { useAuthStore } from "../../store/user/authStore";
import { useProfileStore } from "../../store/user/profileStore";
import { supabase } from "../../utils/supabase";

export default function EditProfileScreen() {
  const router = useRouter();
  const isBackingRef = React.useRef(false);

  const handleBack = React.useCallback(() => {
    if (isBackingRef.current) return;
    isBackingRef.current = true;
    router.back();
    setTimeout(() => {
      isBackingRef.current = false;
    }, 600);
  }, [router]);

  const profile = useProfileStore((s) => s.profile);
  const updateProfile = useProfileStore((s) => s.updateProfile);
  const isLoading = useProfileStore((s) => s.isLoading);
  const lastProfileEditTimestamp = useProfileStore((s) => s.lastProfileEditTimestamp);
  const setLastProfileEditTimestamp = useProfileStore((s) => s.setLastProfileEditTimestamp);
  const user = useAuthStore((s) => s.user);
  const [usernameHandle, setUsernameHandle] = useState(profile?.username || "");
  const [isHandleChecking, setIsHandleChecking] = useState(false);
  const [isHandleAvailable, setIsHandleAvailable] = useState<boolean | null>(true);
  const [handleMsg, setHandleMsg] = useState("");
  const [avatar, setAvatar] = useState(profile?.avatar_url || "");
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [weight, setWeight] = useState(profile?.weight_kg?.toString() || "");
  
  const initialHeightFtIn = profile?.height_cm ? (() => {
    const totalInches = Math.round(profile.height_cm / 2.54);
    const ft = Math.floor(totalInches / 12);
    const inch = totalInches % 12;
    return `${ft}.${inch}`;
  })() : "";
  const [height, setHeight] = useState(initialHeightFtIn);
  
  const [age, setAge] = useState(profile?.age?.toString() || "");
  
  const initialCountry = COUNTRIES.find(c => c.name === profile?.country)?.code || null;
  const [countryCode, setCountryCode] = useState<string | null>(initialCountry);
  const [showCountryModal, setShowCountryModal] = useState(false);
  const selectedCountry = COUNTRIES.find(c => c.code === countryCode);

  const heightInCm = React.useMemo(() => {
    if (!height) return 0;
    const parts = height.split('.');
    const ft = parseInt(parts[0]) || 0;
    const inch = parts.length > 1 ? parseInt(parts[1]) || 0 : 0;
    return Math.round(ft * 30.48 + inch * 2.54);
  }, [height]);

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [cleanHandleToSave, setCleanHandleToSave] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);

  useEffect(() => {
    if (!lastProfileEditTimestamp) {
      setTimeRemaining(null);
      return;
    }

    const checkTime = () => {
      const now = Date.now();
      const timePassed = now - lastProfileEditTimestamp;
      const timeLimit = 24 * 60 * 60 * 1000;
      
      if (timePassed < timeLimit) {
        const timeLeft = timeLimit - timePassed;
        const h = Math.floor(timeLeft / (1000 * 60 * 60));
        const m = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((timeLeft % (1000 * 60)) / 1000);
        
        if (h > 0) {
          setTimeRemaining(`${h}h ${m}m`);
        } else if (m > 0) {
          setTimeRemaining(`${m}m ${s}s`);
        } else {
          setTimeRemaining(`${s}s`);
        }
      } else {
        setTimeRemaining(null);
      }
    };

    checkTime();
    const interval = setInterval(checkTime, 1000);
    return () => clearInterval(interval);
  }, [lastProfileEditTimestamp]);

  const hasChanges = 
    usernameService.formatUsername(usernameHandle) !== profile?.username ||
    avatar !== (profile?.avatar_url || "") ||
    weight !== (profile?.weight_kg?.toString() || "") ||
    height !== initialHeightFtIn ||
    age !== (profile?.age?.toString() || "") ||
    (selectedCountry?.name || null) !== (profile?.country || null);

  useEffect(() => {
    const clean = usernameService.formatUsername(usernameHandle);
    if (!clean) {
      setIsHandleChecking(false);
      setIsHandleAvailable(null);
      setHandleMsg("");
      return;
    }

    if (clean === profile?.username) {
      setIsHandleChecking(false);
      setIsHandleAvailable(true);
      setHandleMsg("Current handle");
      return;
    }

    const fmt = usernameService.validateFormat(clean);
    if (!fmt.isValid) {
      setIsHandleChecking(false);
      setIsHandleAvailable(false);
      setHandleMsg(fmt.message);
      return;
    }

    setIsHandleChecking(true);
    setHandleMsg("Checking availability...");
    setIsHandleAvailable(null);

    const timer = setTimeout(async () => {
      const res = await usernameService.checkAvailability(clean, user?.id);
      setIsHandleChecking(false);
      setIsHandleAvailable(res.isAvailable);
      setHandleMsg(res.message);
    }, 350);

    return () => clearTimeout(timer);
  }, [usernameHandle, user?.id, profile?.username]);



  const pickImage = async () => {
    setIsProcessingImage(true);
    try {
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];

        const size = Math.min(asset.width, asset.height);
        const originX = (asset.width - size) / 2;
        const originY = (asset.height - size) / 2;

        const manipResult = await ImageManipulator.manipulateAsync(
          asset.uri,
          [
            { crop: { originX, originY, width: size, height: size } },
            { resize: { width: 400 } }
          ],
          { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );

        if (manipResult.base64) {
          setAvatar(`data:image/jpeg;base64,${manipResult.base64}`);
        }
      }
    } catch (err) {
      console.error("Image manipulation error:", err);
    } finally {
      setIsProcessingImage(false);
    }
  };

  const confirmAndSave = async (cleanHandle: string) => {
    setIsSaving(true);
    try {
      let finalAvatarUrl = avatar;

      if (avatar.startsWith("data:image")) {
        const base64Data = avatar.split(",")[1];
        const filePath = `${user?.id}/${Date.now()}.jpg`;

        const { data, error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(filePath, decode(base64Data), {
            contentType: "image/jpeg",
            upsert: true,
          });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from("avatars")
          .getPublicUrl(filePath);

        finalAvatarUrl = publicUrlData.publicUrl;
      }

      if (
        profile?.avatar_url &&
        profile.avatar_url.includes("supabase.co/storage/v1/object/public/avatars/") &&
        profile.avatar_url !== finalAvatarUrl
      ) {
        const oldFilePath = profile.avatar_url.split("/avatars/")[1];
        if (oldFilePath) {
          supabase.storage.from("avatars").remove([oldFilePath]).catch(err => {
            console.warn("Failed to delete old avatar:", err);
          });
        }
      }

      await updateProfile({
        username: cleanHandle,
        avatar_url: finalAvatarUrl || null,
        weight_kg: weight ? parseFloat(weight) : null,
        height_cm: height ? heightInCm : null,
        age: age ? parseInt(age, 10) : null,
        country: selectedCountry?.name || null,
        country_flag: selectedCountry?.flag || null,
      });
      router.back();
    } catch (err: any) {
      console.error("Avatar upload error:", err);
      Toast.show({
        type: 'error',
        text1: 'Save Failed',
        text2: 'An error occurred while saving your profile.'
      });
    } finally {
      setIsSaving(false);
      setShowConfirmModal(false);
    }
  };

  const validateInputs = () => {
    const cleanHandle = usernameHandle.trim();
    if (!cleanHandle || cleanHandle.length < 3) return "Username handle must be at least 3 characters.";
    if (cleanHandle.length > 15) return "Username handle cannot exceed 15 characters.";

    if (weight) {
      const w = Number(weight);
      if (isNaN(w) || w < 20 || w > 150) return "Please enter a valid weight (20-150 kg).";
    }
    if (height) {
      const parts = height.split('.');
      const ft = parseInt(parts[0]) || 0;
      const inch = parts.length > 1 ? parseInt(parts[1]) || 0 : 0;
      if (ft < 3 || ft > 8 || inch >= 12) {
        return "Please enter a valid height in FT.IN format (e.g. 5.11). Inches must be between 0 and 11.";
      }
    }
    if (age) {
      const a = Number(age);
      if (isNaN(a) || a < 13 || a > 100) return "Please enter a valid age (13-100).";
    }
    return null;
  };

  const handleSubmit = () => {
    const cleanHandle = usernameService.formatUsername(usernameHandle);
    
    const error = validateInputs();
    if (error) {
      Toast.show({
        type: 'error',
        text1: 'Invalid Input',
        text2: error
      });
      return;
    }

    if (!cleanHandle || isHandleAvailable === false || isHandleChecking) {
      Toast.show({
        type: 'error',
        text1: 'Invalid Username',
        text2: handleMsg || 'Please select a valid and available username handle.'
      });
      return;
    }

    if (!hasChanges) {
      router.back();
      return;
    }

    const now = Date.now();
    if (lastProfileEditTimestamp && now - lastProfileEditTimestamp < 24 * 60 * 60 * 1000) {
      const remainingHours = Math.ceil((24 * 60 * 60 * 1000 - (now - lastProfileEditTimestamp)) / (60 * 60 * 1000));
      Toast.show({
        type: 'error',
        text1: 'Action Not Allowed',
        text2: `You can only edit your profile once every 24 hours. Please try again in ${remainingHours} hours.`
      });
      return;
    }

    setCleanHandleToSave(cleanHandle);
    setShowConfirmModal(true);
  };

  return (
    <View className="flex-1 bg-[#050505]">
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }} pointerEvents="none">
        <PremiumAmbientBackground />
      </View>
      <View className="flex-1 z-10">
        <View className="flex-1 px-6 pt-3 pb-6 justify-between">
          <View>
            <View className="flex-row items-center justify-between mb-2">
              <TouchableOpacity
                onPress={handleBack}
                className="p-2 -ml-2 rounded-full items-center justify-center"
              >
                <ArrowLeft size={24} color="white" />
              </TouchableOpacity>
              <Text className="font-outfitMed tracking-widest uppercase text-white">
                Edit Profile
              </Text>
              <View className="w-9" />
            </View>

            <View className="py-2">
            <View className="items-center mb-2 relative">
              <TouchableOpacity onPress={pickImage} disabled={!!timeRemaining} activeOpacity={0.8} className={`relative ${timeRemaining ? 'opacity-50' : ''}`}>
                <UserAvatar
                  avatarUrl={avatar}
                  size={80}
                  initials={(usernameHandle || "U").substring(0, 2).toUpperCase()}
                  className="w-20 h-20 rounded-full border-2 border-[#3A9E66]/50 shadow-sm"
                  isLoading={isProcessingImage}
                />
                <View className="absolute bottom-0 right-0 bg-[#3A9E66] p-1.5 rounded-full border-2 border-[#050505]">
                  <Upload size={12} color="white" />
                </View>
              </TouchableOpacity>
            </View>

            <View className="mb-3">
              <Text className="text-[10px] font-outfitMed text-white/50 ml-1 mb-1">
                Unique Handle (@username)
              </Text>
              <View
                className={`flex-row items-center bg-[#141414]/95 border rounded-xl px-4 h-12 ${timeRemaining
                  ? "border-white/5 opacity-50 bg-[#121212]"
                  : isHandleAvailable === true
                  ? "border-[#3A9E66]"
                  : isHandleAvailable === false
                    ? "border-red-500"
                    : "border-white/10"
                  }`}
              >
                <AtSign size={16} color="#3A9E66" />
                <TextInput
                  editable={!timeRemaining}
                  value={usernameHandle}
                  onChangeText={(val) => setUsernameHandle(usernameService.formatUsername(val))}
                  placeholder="username"
                  placeholderTextColor="#9F9F99"
                  className="flex-1 ml-3 font-outfitMed text-white text-sm h-full"
                  maxLength={15}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {isHandleChecking && <ActivityIndicator size="small" color="#9F9F99" />}
                {!isHandleChecking && isHandleAvailable === true && (
                  <CheckCircle size={16} color="#3A9E66" />
                )}
                {!isHandleChecking && isHandleAvailable === false && (
                  <XCircle size={16} color="#EF4444" />
                )}
              </View>
              {handleMsg ? (
                <Text
                  className={`text-[9px] font-outfitMed mt-1 ml-1 ${isHandleAvailable === true
                    ? "text-[#3A9E66]"
                    : isHandleAvailable === false
                      ? "text-red-500"
                      : "text-white/40"
                    }`}
                >
                  {handleMsg}
                </Text>
              ) : null}
            </View>

            <View className="mb-3">
              <Text className="text-[10px] font-outfitMed text-white/50 ml-1 mb-1">
                Weight (kg)
              </Text>
              <View className={`flex-row items-center border rounded-xl px-4 h-12 ${timeRemaining ? 'bg-[#121212] border-white/5 opacity-50' : 'bg-[#141414]/95 border-white/10'}`}>
                <TextInput
                  editable={!timeRemaining}
                  value={weight}
                  onChangeText={setWeight}
                  placeholder="70"
                  placeholderTextColor="#9F9F99"
                  keyboardType="numeric"
                  className="flex-1 font-outfitMed text-white text-sm h-full"
                />
              </View>
            </View>

            <View className="mb-3">
              <Text className="text-[10px] font-outfitMed text-white/50 ml-1 mb-1">
                Height (ft.in)
              </Text>
              <View className={`flex-row items-center border rounded-xl px-4 h-12 ${timeRemaining ? 'bg-[#121212] border-white/5 opacity-50' : 'bg-[#141414]/95 border-white/10'}`}>
                <TextInput
                  editable={!timeRemaining}
                  value={height}
                  onChangeText={setHeight}
                  placeholder="5.11"
                  placeholderTextColor="#9F9F99"
                  keyboardType="numeric"
                  className="flex-1 font-outfitMed text-white text-sm h-full"
                />
                {heightInCm > 0 && (
                  <Text className="text-[#3A9E66] font-outfitMed text-xs">{heightInCm}cm</Text>
                )}
              </View>
            </View>

            <View className="mb-3">
              <Text className="text-[10px] font-outfitMed text-white/50 ml-1 mb-1">
                Age
              </Text>
              <View className={`flex-row items-center border rounded-xl px-4 h-12 ${timeRemaining ? 'bg-[#121212] border-white/5 opacity-50' : 'bg-[#141414]/95 border-white/10'}`}>
                <TextInput
                  editable={!timeRemaining}
                  value={age}
                  onChangeText={setAge}
                  placeholder="25"
                  placeholderTextColor="#9F9F99"
                  keyboardType="numeric"
                  className="flex-1 font-outfitMed text-white text-sm h-full"
                />
              </View>
            </View>

            <View className="mb-3">
              <Text className="text-[10px] font-outfitMed text-white/50 ml-1 mb-1">
                Country
              </Text>
              <TouchableOpacity
                onPress={() => !timeRemaining && setShowCountryModal(true)}
                disabled={!!timeRemaining}
                className={`flex-row items-center border rounded-xl px-4 h-12 ${timeRemaining ? 'bg-[#121212] border-white/5 opacity-50' : 'bg-[#141414]/95 border-white/10'}`}
              >
                <Globe size={16} color="#3A9E66" />
                {selectedCountry ? (
                  <Text className="flex-1 ml-3 font-outfitMed text-white text-sm">
                    {selectedCountry.flag} {selectedCountry.name}
                  </Text>
                ) : (
                  <Text className="flex-1 ml-3 font-outfitMed text-[#9F9F99] text-sm">
                    Select your country
                  </Text>
                )}
              </TouchableOpacity>
            </View>
            </View>
          </View>

          <View className="pb-10">
            {timeRemaining && (
              <Text className="text-[#EF4444] font-outfitMed text-[11px] text-center mb-3">
                You can update your profile after {timeRemaining}
              </Text>
            )}
            <SaveButton
              isSaving={isLoading || isProcessingImage}
              isSaved={false}
              hasChanges={hasChanges && !timeRemaining}
              onPress={handleSubmit}
              defaultText="Save Profile"
              savingText="Processing..."
            />
          </View>
        </View>
      </View>

      <ConfirmationModal
        visible={showConfirmModal}
        title="Confirm Changes"
        description="If you save now, you won't be able to edit your profile again for the next 24 hours. Are you sure?"
        confirmText="Save Profile"
        cancelText="Cancel"
        onConfirm={() => {
          setLastProfileEditTimestamp(Date.now());
          void confirmAndSave(cleanHandleToSave);
        }}
        onCancel={() => setShowConfirmModal(false)}
        isLoading={isSaving}
      />

      <CountrySelectModal
        visible={showCountryModal}
        onClose={() => setShowCountryModal(false)}
        onSelect={(code) => setCountryCode(code)}
      />
    </View>
  );
}


