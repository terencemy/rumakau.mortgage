export interface PropertyInfo {
  address: string;
  propertyType: string;
  isBumi: boolean;
  size: string;
  renovationDetails: string;
  spaPrice: number;
  marginRequested: number;
  loanAmount: number;
  loanTenure: number;
  marketValue: number;
  valuerName: string;
  lawyerFirm: string;
}

export interface BorrowerProfile {
  name: string;
  nricLast4: string;
  age: number;
  educationLevel: string;
  isSmoking: boolean;
  maritalStatus: string;
  numberOfChildren: number;
  stayLength: string;
  employment: {
    companyName: string;
    natureOfBusiness: string;
    position: string;
    dateJoined: string;
    monthlyGrossIncome: number;
    fixedIncome: number;
    variableIncome: number;
    otherIncome: number;
  };
  previousEmployment?: {
    yearsInService: number;
    natureOfBusiness: string;
  };
  commitments: Commitments;
}

export interface Commitments {
  carLoan: number;
  personalLoan: number;
  creditCardOutstanding: number;
  otherLoans: number;
  ccrisStatus: 'Clean' | 'Late Payment' | 'Restructured';
}

export interface MortgageAnalysisRequest {
  property: PropertyInfo;
  mainBorrower: BorrowerProfile;
  jointBorrower?: BorrowerProfile;
  banksSubmitted?: string;
  remarks?: string;
  loanTypes: string[];
}

export interface MortgageAnalysisResult {
  dsrMain: number;
  dsrJoint?: number;
  dsrCombined: number;
  netMonthlyIncomeMain: number;
  netMonthlyIncomeJoint?: number;
  stressTestInstallment: number;
  isJointApplication: boolean;
  riskGrade: 'A' | 'B' | 'C';
  loanTypeSuitability: string;
  approvalProbability: number;
  riskFlags: string[];
  strategy: string;
  requiredDocuments: string[];
  clientExplanationBM: string;
  structuringImprovements: string[];
  idealTenure: string;
  bankCategory: 'Conservative' | 'Moderate' | 'Flexible';
}

export interface LeadRecord {
  id?: number;
  timestamp: string;
  contactType: 'email';
  contactValue: string;
  mainBorrowerName: string;
  mainBorrowerIncome: number;
  jointBorrowerName?: string;
  jointBorrowerIncome?: number;
  propertyAddress: string;
  spaPrice: number;
  loanAmount: number;
  dsrCombined: number;
  riskGrade: string;
}
