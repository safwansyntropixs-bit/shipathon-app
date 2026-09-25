import { useRouter } from 'expo-router';
import { ArrowLeft, ArrowRight, Calendar, ChevronDown, Globe, Ruler, Search, Weight, X } from 'lucide-react-native';
import React, { useState } from 'react';
import { ActivityIndicator, FlatList, Keyboard, Modal, Platform, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from "react-native-toast-message";
import { PremiumAmbientBackground } from '../../components/layout/PremiumAmbientBackground';
import { CountrySelectModal } from '../../components/modals/CountrySelectModal';
import { COUNTRIES } from '../../constants/countries';
import { useProfileStore } from '../../store/user/profileStore';

export default function PhysicalMetricsScreen() {
  const router = useRouter();
  const updateProfile = useProfileStore((s) => s.updateProfile);
  const [loading, setLoading] = useState(false);

  const [gender, setGender] = useState<'male' | 'female' | 'other' | null>(null);
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [countryCode, setCountryCode] = useState<string | null>(null);
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  const heightInCm = React.useMemo(() => {
    if (!height) return 0;
    const parts = height.split('.');
    const ft = parseInt(parts[0]) || 0;
    const inch = parts.length > 1 ? parseInt(parts[1]) || 0 : 0;
    return Math.round(ft * 30.48 + inch * 2.54);
  }, [height]);

  const selectedCountry = COUNTRIES.find(c => c.code === countryCode);

  const keyboardShift = useSharedValue(0);

  React.useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e) => {
        keyboardShift.value = withTiming(e.endCoordinates.height, {
          duration: 250,
        });
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => {
        keyboardShift.value = withTiming(0, { duration: 250 });
      }
    );

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const animatedKeyboardStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: -keyboardShift.value }],
    };
  });

  const handleComplete = async () => {
    if (!gender || !age || !weight || !height || !countryCode) {
      Toast.show({
        type: 'error',
        text1: 'Incomplete',
        text2: 'Please fill in all your metrics including country so we can accurately calculate your profile.'
      });
      return;
    }

    const ageNum = parseInt(age, 10);
    const weightNum = parseFloat(weight);
    const parts = height.split('.');
    const ft = parseInt(parts[0]) || 0;
    const inch = parts.length > 1 ? parseInt(parts[1]) || 0 : 0;

    if (ageNum < 13 || ageNum > 100) {
      Toast.show({
        type: 'error',
        text1: 'Invalid Age',
        text2: 'Please enter a valid age between 13 and 100.'
      });
      return;
    }

    if (weightNum < 20 || weightNum > 150) {
      Toast.show({
        type: 'error',
        text1: 'Invalid Weight',
        text2: 'Please enter a valid weight in kg (20 - 150).'
      });
      return;
    }

    if (ft < 3 || ft > 8 || inch >= 12) {
      Toast.show({
        type: 'error',
        text1: 'Invalid Height',
        text2: 'Please enter a valid height in FT.IN format (e.g. 5.11). Inches must be between 0 and 11.'
      });
      return;
    }

    setLoading(true);
    try {
      await updateProfile({
        gender,
        age: parseInt(age, 10),
        weight_kg: parseFloat(weight),
        height_cm: heightInCm,
        country: selectedCountry?.name,
        country_flag: selectedCountry?.flag,
      });
      // Force redirect to tabs, bypassing layout checks momentarily
      router.replace("/(tabs)/home");
    } catch (e) {
      console.error(e);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Could not save profile details.'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-transparent">
      <PremiumAmbientBackground />
      <SafeAreaView className="flex-1" edges={["top", "left", "right"]}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <Animated.View style={[{ flex: 1 }, animatedKeyboardStyle]}>
            <View className="flex-1 px-6">

              {/* Progress Bar */}
              <View className="flex-row items-center justify-between mb-6">
                <View className="h-1.5 flex-1 bg-white/10 rounded-full overflow-hidden">
                  <View className="h-full bg-[#3A9E66] rounded-full" style={{ width: step === 1 ? '50%' : '100%' }} />
                </View>
                <Text className="text-[10px] font-outfitBold text-[#3A9E66] ml-4">{step === 1 ? '50%' : '100%'}</Text>
              </View>

              {step === 2 && (
                <TouchableOpacity onPress={() => setStep(1)} className="flex-row items-center mb-6 self-start rounded-full " activeOpacity={0.7}>
                  <ArrowLeft size={24} color="#cdcdcbff" />
                </TouchableOpacity>
              )}

              <Text className="text-[10px] font-outfitMed tracking-widest text-[#3A9E66] uppercase mb-2">
                {step === 1 ? "Step 1 of 2" : "Final Step"}
              </Text>
              <Text className="text-4xl font-outfitBlack text-white tracking-tight mb-2">
                Your Preferences<Text className="text-[#3A9E66]">.</Text>
              </Text>
              <Text className="text-sm font-outfitReg text-white/60 mb-8 leading-relaxed">
                These details help us set up your profile and accurately calculate your energy burn.
              </Text>

              {step === 1 ? (
                /* Step 1: Personal Profile */
                <View className="bg-[#1C1C1C]/40 p-4 rounded-3xl border border-white/5 mb-8">
                  <Text className="font-outfitBold text-white/80 mb-5">Personal Profile</Text>

                  {/* Gender */}
                  <View className="mb-5">
                    <Text className="text-[10px] font-outfitBold uppercase tracking-wider text-white/40 mb-3 ml-1">Biological Sex</Text>
                    <View className="flex-row gap-3">
                      {(['male', 'female'] as const).map(g => (
                        <TouchableOpacity
                          key={g}
                          onPress={() => setGender(g)}
                          className={`flex-1 items-center justify-center py-3.5 rounded-2xl border ${gender === g ? 'bg-[#3A9E66]/20 border-[#3A9E66]' : 'bg-[#1C1C1C] border-white/10'}`}
                        >
                          <Text className={`font-outfitBold capitalize ${gender === g ? 'text-[#3A9E66]' : 'text-white/60'}`}>{g}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Country */}
                  <View className="mb-2">
                    <Text className="text-[10px] font-outfitBold uppercase tracking-wider text-white/40 mb-3 ml-1">Country</Text>
                    <TouchableOpacity
                      onPress={() => setShowCountryModal(true)}
                      className="flex-row items-center bg-[#1C1C1C] border border-white/10 rounded-2xl px-4 h-14"
                    >
                      <Globe size={20} color="#8FAE8E" />
                      {selectedCountry ? (
                        <Text className="flex-1 ml-3 font-outfitMed text-white text-base">
                          {selectedCountry.flag} {selectedCountry.name}
                        </Text>
                      ) : (
                        <Text className="flex-1 ml-3 font-outfitMed text-[#9F9F99] text-base">
                          Select your country
                        </Text>
                      )}
                      <ChevronDown size={20} color="#9F9F99" />
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                /* Step 2: Body Metrics */
                <View className="bg-[#1C1C1C]/40 p-4 rounded-3xl border border-white/5 mb-8">
                  <Text className="font-outfitBold text-white/80 mb-5">Body Metrics</Text>

                  {/* Age */}
                  <View className="mb-5">
                    <Text className="text-[10px] font-outfitBold uppercase tracking-wider text-white/40 mb-3 ml-1">Age</Text>
                    <View className="flex-row items-center bg-[#1C1C1C] border border-white/10 rounded-2xl px-4 h-14">
                      <Calendar size={20} color="#8FAE8E" />
                      <TextInput
                        value={age}
                        onChangeText={setAge}
                        placeholder="Enter your age"
                        placeholderTextColor="#9F9F99"
                        keyboardType="numeric"
                        maxLength={3}
                        className="flex-1 ml-3 font-outfitMed text-white text-base h-full"
                      />
                      <Text className="text-[10px] font-outfitMed text-white/30 uppercase tracking-widest">Years</Text>
                    </View>
                  </View>

                  {/* Weight */}
                  <View className="mb-5">
                    <Text className="text-[10px] font-outfitBold uppercase tracking-wider text-white/40 mb-3 ml-1">Weight</Text>
                    <View className="flex-row items-center bg-[#1C1C1C] border border-white/10 rounded-2xl px-4 h-14">
                      <Weight size={20} color="#8FAE8E" />
                      <TextInput
                        value={weight}
                        onChangeText={setWeight}
                        placeholder="0.0"
                        placeholderTextColor="#9F9F99"
                        keyboardType="decimal-pad"
                        maxLength={5}
                        className="flex-1 ml-3 font-outfitMed text-white text-base h-full"
                      />
                      <Text className="text-[10px] font-outfitMed text-white/30 uppercase tracking-widest">KG</Text>
                    </View>
                  </View>

                  {/* Height */}
                  <View className="mb-2">
                    <Text className="text-[10px] font-outfitBold uppercase tracking-wider text-white/40 mb-3 ml-1">Height</Text>
                    <View className="flex-row items-center bg-[#1C1C1C] border border-white/10 rounded-2xl px-4 h-14">
                      <Ruler size={20} color="#8FAE8E" />
                      <TextInput
                        value={height}
                        onChangeText={setHeight}
                        placeholder="e.g. 5.11"
                        placeholderTextColor="#9F9F99"
                        keyboardType="decimal-pad"
                        maxLength={5}
                        className="flex-1 ml-3 font-outfitMed text-white text-base h-full"
                      />
                      {height ? (
                        <Text className="text-[10px] font-outfitBold text-[#3A9E66] uppercase tracking-widest mr-2">{heightInCm} CM</Text>
                      ) : null}
                      <Text className="text-[10px] font-outfitMed text-white/30 uppercase tracking-widest">FT.IN</Text>
                    </View>
                  </View>
                </View>
              )}

              {step === 1 ? (
                <TouchableOpacity
                  onPress={() => setStep(2)}
                  disabled={!gender || !countryCode}
                  className={`w-full h-14 rounded-full flex-row items-center justify-center ${!gender || !countryCode
                      ? 'bg-[#2A2A2A]'
                      : 'bg-[#3A9E66]'
                    }`}
                >
                  <Text className={`font-outfitBold mr-2 ${!gender || !countryCode ? 'text-[#71717A]' : 'text-white'}`}>
                    Next
                  </Text>
                  <ArrowRight size={18} color={!gender || !countryCode ? '#71717A' : 'white'} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={handleComplete}
                  disabled={loading || !age || !weight || !height}
                  className={`w-full h-14 rounded-full flex-row items-center justify-center ${!age || !weight || !height
                      ? 'bg-[#2A2A2A]'
                      : 'bg-[#3A9E66]'
                    }`}
                >
                  {loading ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <>
                      <Text className={`font-outfitBold mr-2 ${!age || !weight || !height ? 'text-[#71717A]' : 'text-white'}`}>
                        Done
                      </Text>
                      <ArrowRight size={18} color={!age || !weight || !height ? '#71717A' : 'white'} />
                    </>
                  )}
                </TouchableOpacity>
              )}

            </View>
          </Animated.View>
        </TouchableWithoutFeedback>

        <CountrySelectModal
          visible={showCountryModal}
          onClose={() => setShowCountryModal(false)}
          onSelect={(code) => setCountryCode(code)}
        />

      </SafeAreaView>
    </View>
  );
}
