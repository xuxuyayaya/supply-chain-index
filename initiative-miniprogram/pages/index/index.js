const content = require('../../content');
const pdf = require('../../pdf');
const logo = require('../../logo');
const storageKey = 'logistics-initiative-20261219-native-v1';
Page({
  data: {
    content, companies: content.companies.concat(['其他']),
    companyIndex:-1, selectedCompany:'', otherCompany:'',
    hasRead:false, submitting:false, generating:false,
    record:null, confirmedTime:'', pdfPath:'', error:'', scrollTarget:'',
    canShare: false, logoSrc:''
  },
  onLoad() {
    this.setData({canShare:wx.canIUse('shareFileMessage')});
    try {
      const path = wx.env.USER_DATA_PATH + '/china-unidata-logo.png';
      wx.getFileSystemManager().writeFileSync(path, logo, 'base64');
      this.setData({logoSrc:path});
    } catch (error) {}
    try {
      const record = wx.getStorageSync(storageKey);
      if (record && record.status === 'server-confirmed' && record.company && record.confirmedAt) this.showRecord(record);
    } catch (error) {}
  },
  markRead() { this.setData({hasRead:true}); },
  chooseCompany(event) {
    const index = Number(event.detail.value);
    this.setData({companyIndex:index,selectedCompany:this.data.companies[index],otherCompany:''});
  },
  editOther(event) { this.setData({otherCompany:event.detail.value}); },
  showRecord(record) {
    this.setData({record,confirmedTime:pdf.localTime(record.confirmedAt),scrollTarget:'receipt'});
  },
  submit() {
    if (!this.data.hasRead || this.data.submitting) return;
    const company = (this.data.selectedCompany === '其他' ? this.data.otherCompany : this.data.selectedCompany).trim();
    if (!company || company.length > 100) {
      wx.showToast({title:'请选择或填写单位全称',icon:'none'}); return;
    }
    if (!this.responseId) this.responseId = Date.now() + '-' + Math.random().toString(36).slice(2);
    const data = {
      initiative:content.title, version:'2026-12-19', company,
      confirmed:'已阅读并确认响应', confirmedAt:new Date().toISOString(),
      response_id:this.responseId
    };
    this.setData({submitting:true,error:''});
    wx.request({
      url:'https://dkfile.istester.com/api/forms/submit/logistics-initiative-20261219',
      method:'POST', header:{'Content-Type':'application/json'}, data, timeout:20000,
      success: response => {
        if (response.statusCode !== 200 || !response.data || response.data.success !== true) {
          this.setData({error:'提交未成功，请稍后重试。'}); return;
        }
        const record = Object.assign({},data,{status:'server-confirmed'});
        try { wx.setStorageSync(storageKey,record); } catch (error) {}
        this.showRecord(record);
      },
      fail: () => this.setData({error:'未收到服务器确认，请检查网络后重新提交。'}),
      complete: () => this.setData({submitting:false})
    });
  },
  async openPdf() {
    if (this.data.generating || !this.data.record) return;
    this.setData({generating:true,error:''});
    wx.showLoading({title:'正在生成PDF',mask:true});
    try {
      const path = this.data.pdfPath || await pdf.generate(this,this.data.record);
      this.setData({pdfPath:path});
      wx.hideLoading();
      await new Promise((resolve,reject) => wx.openDocument({
        filePath:path, fileType:'pdf', showMenu:true, success:resolve, fail:reject
      }));
    } catch (error) {
      wx.hideLoading();
      const message = error.message || error.errMsg || '请稍后重试';
      this.setData({error:'PDF打开失败：' + message});
      wx.showModal({title:'PDF暂未打开',content:message,showCancel:false});
    } finally {
      this.setData({generating:false});
    }
  },
  async sharePdf() {
    if (this.data.generating || !this.data.record) return;
    this.setData({generating:true,error:''});
    try {
      const path = this.data.pdfPath || await pdf.generate(this,this.data.record);
      this.setData({pdfPath:path});
      await new Promise((resolve,reject) => wx.shareFileMessage({
        filePath:path,fileName:'倡议响应凭证-' + this.data.record.company + '.pdf',
        success:resolve,fail:reject
      }));
    } catch (error) {
      if (!/cancel/i.test(error.errMsg || '')) this.setData({error:'转发未完成，请打开PDF后使用右上角菜单保存或转发。'});
    } finally { this.setData({generating:false}); }
  }
});
