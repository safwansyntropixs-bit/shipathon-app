import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, TextInput, FlatList } from 'react-native';
import { Search, X } from 'lucide-react-native';
import { PremiumAmbientBackground } from '../layout/PremiumAmbientBackground';
import { ModalTopBorder } from '../ui/ModalTopBorder';
import { COUNTRIES } from '../../constants/countries';

interface CountrySelectModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (countryCode: string) => void;
}

export function CountrySelectModal({ visible, onClose, onSelect }: CountrySelectModalProps) {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-[#050505] pt-6 px-6 overflow-hidden relative">
        <ModalTopBorder theme="emerald" />
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }} pointerEvents="none">
          <PremiumAmbientBackground />
        </View>
        <View className="flex-row items-center justify-between mb-6 mt-10 z-10">
          <Text className="text-2xl font-outfitBold text-white tracking-tight">Select Country</Text>
          <TouchableOpacity onPress={onClose} className="p-2 bg-[#1C1C1C] rounded-full border border-white/10" activeOpacity={0.7}>
            <X size={20} color="#A1A1AA" />
          </TouchableOpacity>
        </View>
        <View className="flex-row items-center bg-[#1C1C1C] border border-white/10 rounded-2xl px-4 h-14 mb-6 z-10">
          <Search size={20} color="#9F9F99" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search countries..."
            placeholderTextColor="#9F9F99"
            className="flex-1 ml-3 font-outfitMed text-white text-base h-full"
            selectionColor="#3A9E66"
          />
        </View>
        <FlatList
          className="z-10"
          data={COUNTRIES.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))}
          keyExtractor={item => item.code}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => {
                onSelect(item.code);
                onClose();
                setSearchQuery('');
              }}
              className="flex-row items-center p-4 mb-3 bg-[#1C1C1C]/40 border border-white/5 rounded-2xl"
              activeOpacity={0.7}
            >
              <Text className="text-3xl mr-4">{item.flag}</Text>
              <Text className="text-lg font-outfitMed text-white/90">{item.name}</Text>
            </TouchableOpacity>
          )}
          initialNumToRender={15}
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      </View>
    </Modal>
  );
}
