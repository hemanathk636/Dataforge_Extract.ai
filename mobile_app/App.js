import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Modal,
  Alert,
  ActivityIndicator,
  Share,
  StatusBar,
  SafeAreaView,
  Platform,
} from 'react-native';

const DEFAULT_SERVER_URL = "http://10.228.155.159:8080";

export default function App() {
  const [activeTab, setActiveTab] = useState('hub'); // hub | scan | editor | files | settings
  const [serverUrl, setServerUrl] = useState(DEFAULT_SERVER_URL);
  const [serverStatus, setServerStatus] = useState('checking'); // online | offline | checking

  // Extraction State
  const [targetUrl, setTargetUrl] = useState('https://books.toscrape.com');
  const [scrapeMode, setScrapeMode] = useState('ecommerce');
  const [loading, setLoading] = useState(false);
  const [extractedData, setExtractedData] = useState([]);
  const [extractedColumns, setExtractedColumns] = useState([]);
  const [latestDownloads, setLatestDownloads] = useState({ excel: '', csv: '' });

  // Camera / Invoice Scan State
  const [invoiceMetadata, setInvoiceMetadata] = useState(null);
  const [scanLoading, setScanLoading] = useState(false);

  // In-App Editor State
  const [editingItemIndex, setEditingItemIndex] = useState(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editFormData, setEditFormData] = useState({});

  // History & Files State
  const [historyList, setHistoryList] = useState([]);

  // Check backend server connection on startup
  useEffect(() => {
    checkServerConnection();
  }, [serverUrl]);

  const checkServerConnection = async () => {
    setServerStatus('checking');
    try {
      const res = await fetch(`${serverUrl}/api/network-info`);
      if (res.ok) {
        setServerStatus('online');
      } else {
        setServerStatus('offline');
      }
    } catch (err) {
      setServerStatus('offline');
    }
  };

  // 1. Run Web Extraction from Mobile
  const handleExtract = async (overrideUrl, overrideMode) => {
    const url = overrideUrl || targetUrl;
    const mode = overrideMode || scrapeMode;
    if (!url) {
      Alert.alert('Required', 'Please enter a target URL to extract data.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${serverUrl}/api/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, mode, max_items: 50 }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setExtractedData(data.data);
        setExtractedColumns(data.columns || Object.keys(data.data[0] || {}));
        const dl = {
          excel: `${serverUrl}${data.downloads.excel}`,
          csv: `${serverUrl}${data.downloads.csv}`,
        };
        setLatestDownloads(dl);

        // Add to history
        const newHist = {
          id: Date.now().toString(),
          title: url,
          mode: mode,
          count: data.data.length,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          downloads: dl,
        };
        setHistoryList((prev) => [newHist, ...prev.slice(0, 14)]);

        Alert.alert('Success', `Extracted ${data.data.length} items! Switched to Editable Table.`);
        setActiveTab('editor');
      } else {
        Alert.alert('Extraction Failed', data.detail || 'Could not extract data from target.');
      }
    } catch (err) {
      Alert.alert('Connection Error', `Failed to contact server at ${serverUrl}. Ensure phone is on same Wi-Fi.`);
    } finally {
      setLoading(false);
    }
  };

  // 2. Camera / Invoice Scanner (Upload or Sample Invoice Simulation)
  const handleScanInvoice = async (mode = 'sample') => {
    setScanLoading(true);
    try {
      const res = await fetch(`${serverUrl}/api/demo-invoice`);
      const data = await res.json();
      if (data.success) {
        setInvoiceMetadata(data.metadata);
        setExtractedData(data.data);
        setExtractedColumns(data.columns);
        const dl = {
          excel: `${serverUrl}${data.downloads.excel}`,
          csv: `${serverUrl}${data.downloads.csv}`,
        };
        setLatestDownloads(dl);

        // Add to history
        setHistoryList((prev) => [
          {
            id: Date.now().toString(),
            title: `Invoice #${data.metadata?.Invoice_Number || 'INV-88219'}`,
            mode: 'pdf',
            count: data.data.length,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            downloads: dl,
          },
          ...prev,
        ]);

        Alert.alert('Invoice Parsed', `Vendor: ${data.metadata?.Vendor || 'N/A'}\nTotal: ${data.metadata?.Total_Amount || 'N/A'}`);
      }
    } catch (err) {
      Alert.alert('Scan Error', 'Unable to reach backend invoice engine.');
    } finally {
      setScanLoading(false);
    }
  };

  // 3. Open In-App Cell Editor for a specific row
  const openEditModal = (item, index) => {
    setEditingItemIndex(index);
    setEditFormData({ ...item });
    setEditModalVisible(true);
  };

  // 4. Save edits in the Mobile App and Sync with Backend Excel Generator
  const saveRowEdits = async () => {
    if (editingItemIndex === null) return;
    const updatedList = [...extractedData];
    updatedList[editingItemIndex] = editFormData;
    setExtractedData(updatedList);
    setEditModalVisible(false);

    // Call backend to regenerate updated Excel with user's edits!
    try {
      const res = await fetch(`${serverUrl}/api/export-custom-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: updatedList,
          sheet_name: 'Mobile Edited Items',
        }),
      });
      const data = await res.json();
      if (data.success && data.downloads) {
        setLatestDownloads({
          excel: `${serverUrl}${data.downloads.excel}`,
          csv: `${serverUrl}${data.downloads.csv}`,
        });
        Alert.alert('Changes Applied', 'Updated values saved! Fresh .xlsx and .csv ready for download.');
      }
    } catch (err) {
      Alert.alert('Notice', 'Edits saved locally on device.');
    }
  };

  // 5. Share / Download File via Mobile System Share Sheet
  const handleShareFile = async (url, title) => {
    if (!url) {
      Alert.alert('No file', 'Please run an extraction first.');
      return;
    }
    try {
      await Share.share({
        message: `Extract Mobile Deliverable: ${title}\nDownload link: ${url}`,
        url: url,
      });
    } catch (error) {
      Alert.alert('Share Error', error.message);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

      {/* TOP NATIVE APP BAR */}
      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoEmoji}>🤖</Text>
          </View>
          <View>
            <Text style={styles.brandTitle}>Extract Mobile</Text>
            <Text style={styles.brandSub}>Autonomous Scraping & Invoices</Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => setActiveTab('settings')}
          style={[styles.statusBadge, serverStatus === 'online' ? styles.statusOnline : styles.statusOffline]}
        >
          <View style={[styles.statusDot, { backgroundColor: serverStatus === 'online' ? '#10b981' : '#f43f5e' }]} />
          <Text style={styles.statusText}>{serverStatus === 'online' ? 'Online LAN' : 'Offline'}</Text>
        </TouchableOpacity>
      </View>

      {/* BODY VIEW ROUTER */}
      <View style={styles.content}>
        {activeTab === 'hub' && (
          <ScrollView style={styles.scrollArea}>
            <View style={styles.card}>
              <Text style={styles.cardHeader}>⚡ 1-Tap Mobile Scraper</Text>
              <Text style={styles.cardDesc}>Extract products, real estate, or directory leads into styled spreadsheets.</Text>

              <Text style={styles.inputLabel}>Target Website URL</Text>
              <TextInput
                style={styles.textInput}
                value={targetUrl}
                onChangeText={setTargetUrl}
                placeholder="https://example.com/products"
                placeholderTextColor="#94a3b8"
                autoCapitalize="none"
              />

              <Text style={styles.inputLabel}>Extraction Mode</Text>
              <View style={styles.modeRow}>
                {['ecommerce', 'leads', 'smart'].map((mode) => (
                  <TouchableOpacity
                    key={mode}
                    onPress={() => setScrapeMode(mode)}
                    style={[styles.modePill, scrapeMode === mode && styles.modePillActive]}
                  >
                    <Text style={[styles.modePillText, scrapeMode === mode && styles.modePillTextActive]}>
                      {mode === 'ecommerce' ? '🛒 Products' : mode === 'leads' ? '💼 Leads' : '🧠 Smart'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                onPress={() => handleExtract()}
                disabled={loading}
                style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryBtnText}>Start Extraction &rarr;</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Quick Presets */}
            <View style={styles.card}>
              <Text style={styles.cardHeader}>🎯 Flagship 1-Tap Presets</Text>
              <View style={styles.presetList}>
                <TouchableOpacity
                  onPress={() => {
                    setTargetUrl('https://books.toscrape.com');
                    setScrapeMode('ecommerce');
                    handleExtract('https://books.toscrape.com', 'ecommerce');
                  }}
                  style={styles.presetItem}
                >
                  <Text style={styles.presetTitle}>1. E-Commerce Product Tracker</Text>
                  <Text style={styles.presetDesc}>Extracts titles, prices, ratings, availability</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    setTargetUrl('sample://directory/leads');
                    setScrapeMode('leads');
                    handleExtract('sample://directory/leads', 'leads');
                  }}
                  style={styles.presetItem}
                >
                  <Text style={styles.presetTitle}>2. Business Lead Scraper</Text>
                  <Text style={styles.presetDesc}>Extracts company names, emails, phones & addresses</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        )}

        {/* 📸 CAMERA INVOICE SCANNER TAB */}
        {activeTab === 'scan' && (
          <ScrollView style={styles.scrollArea}>
            <View style={styles.card}>
              <Text style={styles.cardHeader}>📸 Camera Invoice & Receipt Scanner</Text>
              <Text style={styles.cardDesc}>Snap a photo of paper invoices or receipts to automatically extract metadata and line items.</Text>

              <TouchableOpacity
                onPress={() => handleScanInvoice('sample')}
                disabled={scanLoading}
                style={styles.scanBtn}
              >
                {scanLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.scanBtnText}>📷 Snap / Scan Invoice Now</Text>
                )}
              </TouchableOpacity>

              {invoiceMetadata && (
                <View style={styles.invoiceCard}>
                  <Text style={styles.invoiceTitle}>Audit Metadata Extracted:</Text>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Invoice #:</Text>
                    <Text style={styles.metaVal}>{invoiceMetadata.Invoice_Number || 'INV-88219'}</Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Date:</Text>
                    <Text style={styles.metaVal}>{invoiceMetadata.Date || '2026-11-09'}</Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Vendor:</Text>
                    <Text style={styles.metaVal}>{invoiceMetadata.Vendor || 'Logistics Corp'}</Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Total Amount:</Text>
                    <Text style={[styles.metaVal, { color: '#7c3aed', fontWeight: 'bold' }]}>
                      {invoiceMetadata.Total_Amount || '$4,850.00'}
                    </Text>
                  </View>

                  <TouchableOpacity onPress={() => setActiveTab('editor')} style={styles.viewItemsBtn}>
                    <Text style={styles.viewItemsBtnText}>Edit Line Items in Table &rarr;</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </ScrollView>
        )}

        {/* ✏️ EDITABLE DATA GRID TAB */}
        {activeTab === 'editor' && (
          <View style={{ flex: 1 }}>
            <View style={styles.editorHeader}>
              <Text style={styles.editorCountText}>
                {extractedData.length} Items Captured (Tap row to edit)
              </Text>
              {latestDownloads.excel ? (
                <TouchableOpacity
                  onPress={() => handleShareFile(latestDownloads.excel, 'Extracted Data.xlsx')}
                  style={styles.downloadExcelPill}
                >
                  <Text style={styles.downloadExcelPillText}>📥 Export Excel</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {extractedData.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>📊</Text>
                <Text style={styles.emptyTitle}>No data loaded yet</Text>
                <Text style={styles.emptySub}>Run an extraction from the Hub or scan an invoice to edit items.</Text>
                <TouchableOpacity onPress={() => setActiveTab('hub')} style={styles.primaryBtnSmall}>
                  <Text style={styles.primaryBtnText}>Go to Extract Hub</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <FlatList
                data={extractedData}
                keyExtractor={(item, idx) => idx.toString()}
                renderItem={({ item, index }) => (
                  <TouchableOpacity
                    style={styles.dataRowCard}
                    onPress={() => openEditModal(item, index)}
                  >
                    <View style={styles.dataRowTop}>
                      <Text style={styles.dataRowTitle} numberOfLines={1}>
                        {item.Title || item['Business Name'] || item['Item Description'] || `Item #${index + 1}`}
                      </Text>
                      <Text style={styles.dataRowEditBadge}>✏️ Tap to Edit</Text>
                    </View>

                    <View style={styles.dataRowPills}>
                      {(item.Price || item.Total || item['Total Amount']) && (
                        <View style={styles.pillPurple}>
                          <Text style={styles.pillPurpleText}>{item.Price || item.Total || item['Total Amount']}</Text>
                        </View>
                      )}
                      {(item.Availability || item['CRM Status'] || item.Status) && (
                        <View style={styles.pillGreen}>
                          <Text style={styles.pillGreenText}>
                            {item.Availability || item['CRM Status'] || item.Status}
                          </Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        )}

        {/* 📥 FILES & RECENT ACTIVITY TAB */}
        {activeTab === 'files' && (
          <ScrollView style={styles.scrollArea}>
            <View style={styles.card}>
              <Text style={styles.cardHeader}>📜 Recent Activity & Downloads</Text>
              <Text style={styles.cardDesc}>Directly download, open or share your previous spreadsheet extractions.</Text>

              {historyList.length === 0 ? (
                <Text style={styles.emptyHistoryText}>No downloads yet. Run an extraction to record history!</Text>
              ) : (
                historyList.map((item) => (
                  <View key={item.id} style={styles.historyItemCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.historyTitle} numberOfLines={1}>{item.title}</Text>
                      <Text style={styles.historySub}>{item.time} &bull; {item.count} items</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleShareFile(item.downloads.excel, `${item.title}.xlsx`)}
                      style={styles.shareBtn}
                    >
                      <Text style={styles.shareBtnText}>Share .xlsx</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
          </ScrollView>
        )}

        {/* ⚙️ SETTINGS & SERVER CONFIG TAB */}
        {activeTab === 'settings' && (
          <ScrollView style={styles.scrollArea}>
            <View style={styles.card}>
              <Text style={styles.cardHeader}>⚙️ Backend Server Connection</Text>
              <Text style={styles.cardDesc}>Configure the IP address of your running FastAPI server.</Text>

              <Text style={styles.inputLabel}>Server URL</Text>
              <TextInput
                style={styles.textInput}
                value={serverUrl}
                onChangeText={setServerUrl}
                placeholder="http://10.228.155.159:8080"
                placeholderTextColor="#94a3b8"
                autoCapitalize="none"
              />

              <TouchableOpacity onPress={checkServerConnection} style={styles.primaryBtn}>
                <Text style={styles.primaryBtnText}>Test Server Connection</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}
      </View>

      {/* MODAL: IN-APP CELL EDITOR */}
      <Modal visible={editModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>✏️ Edit Row Data</Text>
            <Text style={styles.modalSub}>Changes will immediately update the exported Excel spreadsheet.</Text>

            <ScrollView style={{ maxHeight: 320, marginVertical: 12 }}>
              {Object.keys(editFormData).map((key) => (
                <View key={key} style={{ marginBottom: 10 }}>
                  <Text style={styles.fieldLabel}>{key}</Text>
                  <TextInput
                    style={styles.textInput}
                    value={String(editFormData[key] || '')}
                    onChangeText={(txt) => setEditFormData((prev) => ({ ...prev, [key]: txt }))}
                  />
                </View>
              ))}
            </ScrollView>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity onPress={() => setEditModalVisible(false)} style={styles.modalCancelBtn}>
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={saveRowEdits} style={styles.modalSaveBtn}>
                <Text style={styles.modalSaveBtnText}>Save & Sync Excel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* BOTTOM NAVIGATION TAB BAR */}
      <View style={styles.tabBar}>
        {[
          { id: 'hub', icon: '⚡', label: 'Extract' },
          { id: 'scan', icon: '📸', label: 'Scan' },
          { id: 'editor', icon: '✏️', label: 'Editor' },
          { id: 'files', icon: '📥', label: 'Files' },
          { id: 'settings', icon: '⚙️', label: 'Config' },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.id}
            onPress={() => setActiveTab(tab.id)}
            style={[styles.tabItem, activeTab === tab.id && styles.tabItemActive]}
          >
            <Text style={styles.tabIcon}>{tab.icon}</Text>
            <Text style={[styles.tabLabel, activeTab === tab.id && styles.tabLabelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    backgroundColor: '#0f172a',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  logoEmoji: {
    fontSize: 18,
  },
  brandTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
  },
  brandSub: {
    color: '#94a3b8',
    fontSize: 10,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusOnline: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: '#10b981',
  },
  statusOffline: {
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    borderColor: '#f43f5e',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollArea: {
    flex: 1,
    padding: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 14,
    lineHeight: 16,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0f172a',
    marginBottom: 12,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  modePill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  modePillActive: {
    backgroundColor: '#7c3aed',
    borderColor: '#6d28d9',
  },
  modePillText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#475569',
  },
  modePillTextActive: {
    color: '#ffffff',
  },
  primaryBtn: {
    backgroundColor: '#7c3aed',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  presetList: {
    gap: 10,
  },
  presetItem: {
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  presetTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  presetDesc: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  scanBtn: {
    backgroundColor: '#0f172a',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginVertical: 10,
  },
  scanBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  invoiceCard: {
    backgroundColor: '#faf5ff',
    borderWidth: 1,
    borderColor: '#e9d5ff',
    borderRadius: 14,
    padding: 14,
    marginTop: 10,
  },
  invoiceTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#6b21a8',
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f3e8ff',
  },
  metaLabel: {
    fontSize: 11,
    color: '#7e22ce',
  },
  metaVal: {
    fontSize: 11,
    color: '#3b0764',
    fontWeight: '600',
  },
  viewItemsBtn: {
    marginTop: 10,
    backgroundColor: '#7c3aed',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  viewItemsBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  editorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  editorCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  downloadExcelPill: {
    backgroundColor: '#10b981',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  downloadExcelPillText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  dataRowCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 12,
    marginVertical: 6,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  dataRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dataRowTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0f172a',
    marginRight: 8,
  },
  dataRowEditBadge: {
    fontSize: 10,
    color: '#7c3aed',
    fontWeight: 'bold',
  },
  dataRowPills: {
    flexDirection: 'row',
    gap: 6,
  },
  pillPurple: {
    backgroundColor: '#f3e8ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pillPurpleText: {
    color: '#7c3aed',
    fontSize: 10,
    fontWeight: 'bold',
  },
  pillGreen: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pillGreenText: {
    color: '#059669',
    fontSize: 10,
    fontWeight: 'bold',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  emptySub: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  primaryBtnSmall: {
    backgroundColor: '#7c3aed',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  historyItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  historyTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  historySub: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  shareBtn: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  shareBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#334155',
  },
  emptyHistoryText: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    paddingVertical: 20,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    paddingVertical: 6,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  tabItemActive: {
    borderTopWidth: 2,
    borderTopColor: '#7c3aed',
  },
  tabIcon: {
    fontSize: 16,
    marginBottom: 2,
  },
  tabLabel: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '600',
  },
  tabLabelActive: {
    color: '#a855f7',
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  modalSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#475569',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalCancelBtnText: {
    color: '#475569',
    fontWeight: 'bold',
    fontSize: 12,
  },
  modalSaveBtn: {
    flex: 1,
    backgroundColor: '#7c3aed',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalSaveBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 12,
  },
});
