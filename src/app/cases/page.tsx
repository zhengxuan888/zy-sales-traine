'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  BookOpen,
  Search,
  Filter,
  Eye,
  TrendingUp,
  Upload,
  X,
  Image as ImageIcon,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Pagination } from '@/components/pagination';

interface ConversationMessage {
  role: 'buyer' | 'seller';
  content: string;
}

interface KeyMoment {
  type: string;
  description: string;
}

interface BestResponse {
  scenario: string;
  response: string;
  explanation: string;
}

interface Case {
  id: string;
  title: string;
  description: string;
  source: string;
  product_type: string;
  difficulty: number;
  tags: string[];
  practice_count: number;
  avg_similarity_score: number | null;
  created_at: string;
  conversation_data: ConversationMessage[] | null;
  key_moments: KeyMoment[] | null;
  best_responses: BestResponse[] | null;
  screenshots: string[];
}

export default function CasesPage() {
  const router = useRouter();
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState<string>('all');
  const [filterProductType, setFilterProductType] = useState<string>('all');
  const [filterCountry, setFilterCountry] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [countries, setCountries] = useState<{ country_code: string; country_name: string }[]>([]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [screenshotUrls, setScreenshotUrls] = useState<Record<string, string>>({});

  // Upload form state
  const [uploadForm, setUploadForm] = useState({
    title: '',
    description: '',
    product_type: '',
    difficulty: '3',
    tags: '',
    outcome: 'success',
    conversation_text: '',
  });
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadPreviews, setUploadPreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchCountries();
  }, []);

  useEffect(() => {
    fetchCases();
  }, [currentPage, searchQuery, filterDifficulty, filterProductType, filterCountry, pageSize]);

  const fetchCountries = async () => {
    try {
      const res = await fetch('/api/countries');
      const data = await res.json();
      if (data.success) {
        setCountries(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch countries:', error);
    }
  };

  const fetchCases = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', currentPage.toString());
      params.set('limit', pageSize.toString());
      if (searchQuery) params.set('search', searchQuery);
      if (filterDifficulty !== 'all') params.set('difficulty', filterDifficulty);
      if (filterProductType !== 'all') params.set('product_type', filterProductType);
      if (filterCountry !== 'all') params.set('country', filterCountry);

      const res = await fetch(`/api/cases?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setCases(data.data as Case[]);
        setTotalPages(data.pagination?.totalPages || 1);
      }
    } catch (error) {
      console.error('Failed to fetch cases:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  // Reset to page 1 when filters change
  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, filterDifficulty, filterProductType, filterCountry]);

  // Fetch screenshot URLs when a case is selected
  useEffect(() => {
    if (selectedCase && selectedCase.screenshots?.length > 0) {
      fetchScreenshotUrls(selectedCase.id, selectedCase.screenshots);
    }
  }, [selectedCase]);

  const fetchScreenshotUrls = async (caseId: string, keys: string[]) => {
    try {
      const res = await fetch(`/api/cases/${caseId}/screenshots`);
      const data = await res.json();
      if (data.success && data.data) {
        const urlMap: Record<string, string> = {};
        data.data.forEach((item: { key: string; url: string }) => {
          urlMap[item.key] = item.url;
        });
        setScreenshotUrls(urlMap);
      }
    } catch (error) {
      console.error('Failed to fetch screenshot URLs:', error);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Limit to 5 files
    const newFiles = [...uploadFiles, ...files].slice(0, 5);
    setUploadFiles(newFiles);

    // Generate previews
    const previews: string[] = [];
    newFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        previews.push(e.target?.result as string);
        if (previews.length === newFiles.length) {
          setUploadPreviews(previews);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeFile = (index: number) => {
    const newFiles = uploadFiles.filter((_, i) => i !== index);
    const newPreviews = uploadPreviews.filter((_, i) => i !== index);
    setUploadFiles(newFiles);
    setUploadPreviews(newPreviews);
  };

  const handleUpload = async () => {
    if (!uploadForm.title || uploadFiles.length === 0) {
      alert('请填写标题并上传至少一张截图');
      return;
    }

    setUploading(true);
    try {
      // Step 1: Upload screenshots
      const formData = new FormData();
      uploadFiles.forEach((file) => {
        formData.append('files', file);
      });

      const uploadRes = await fetch('/api/cases/upload', {
        method: 'POST',
        body: formData,
      });
      const uploadData = await uploadRes.json();

      if (!uploadData.success) {
        throw new Error(uploadData.error || 'Upload failed');
      }

      // Step 2: Create case with screenshot keys
      const caseRes = await fetch('/api/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: uploadForm.title,
          description: uploadForm.description,
          product_type: uploadForm.product_type,
          difficulty: parseInt(uploadForm.difficulty),
          tags: uploadForm.tags.split(',').map((t) => t.trim()).filter(Boolean),
          screenshots: uploadData.data.keys,
          conversation_data: {
            text: uploadForm.conversation_text,
            outcome: uploadForm.outcome,
          },
          source: 'user_upload',
        }),
      });
      const caseData = await caseRes.json();

      if (!caseData.success) {
        throw new Error(caseData.error || 'Failed to create case');
      }

      // Reset and close
      setUploadForm({
        title: '',
        description: '',
        product_type: '',
        difficulty: '3',
        tags: '',
        outcome: 'success',
        conversation_text: '',
      });
      setUploadFiles([]);
      setUploadPreviews([]);
      setUploadOpen(false);
      fetchCases();
      alert('案例上传成功！');
    } catch (error) {
      console.error('Upload error:', error);
      alert('上传失败: ' + (error as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const handleViewCase = (c: Case) => {
    setSelectedCase(c);
    setDetailOpen(true);
  };

  const handleStartPractice = (c: Case) => {
    router.push(`/training/new?caseId=${c.id}`);
  };

  const getDifficultyLabel = (d: number) => {
    if (d <= 2) return { text: '简单', color: 'bg-green-500/20 text-green-400' };
    if (d <= 3) return { text: '中等', color: 'bg-yellow-500/20 text-yellow-400' };
    return { text: '困难', color: 'bg-red-500/20 text-red-400' };
  };

  const productTypes = [...new Set(cases.map((c) => c.product_type).filter(Boolean))];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
              <BookOpen className="h-5 w-5 text-accent" />
            </div>
            <div>
              <h1 className="text-xl font-bold">真实案例学习</h1>
              <p className="text-sm text-muted-foreground">
                从真实交易中学习最佳实践
              </p>
            </div>
          </div>
          <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Upload className="mr-2 h-4 w-4" />
                上传案例
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>上传交易案例</DialogTitle>
                <DialogDescription>
                  上传真实交易截图，分享成功或失败经验
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                {/* Screenshot Upload Area */}
                <div className="space-y-2">
                  <Label>交易截图 *</Label>
                  <div
                    className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-accent/50 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploadPreviews.length === 0 ? (
                      <div className="space-y-2">
                        <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          点击上传截图（最多5张）
                        </p>
                        <p className="text-xs text-muted-foreground">
                          支持 JPG、PNG 格式
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        {uploadPreviews.map((preview, idx) => (
                          <div key={idx} className="relative group">
                            <img
                              src={preview}
                              alt={`Preview ${idx + 1}`}
                              className="w-full h-20 object-cover rounded"
                            />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeFile(idx);
                              }}
                              className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                        {uploadFiles.length < 5 && (
                          <div className="w-full h-20 flex items-center justify-center border border-dashed border-border rounded">
                            <Upload className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                </div>

                {/* Title */}
                <div className="space-y-2">
                  <Label>案例标题 *</Label>
                  <Input
                    placeholder="如：成功说服犹豫型买家"
                    value={uploadForm.title}
                    onChange={(e) =>
                      setUploadForm({ ...uploadForm, title: e.target.value })
                    }
                  />
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label>案例描述</Label>
                  <Textarea
                    placeholder="简要描述这个案例的背景和结果..."
                    value={uploadForm.description}
                    onChange={(e) =>
                      setUploadForm({ ...uploadForm, description: e.target.value })
                    }
                    rows={2}
                  />
                </div>

                {/* Product Type & Difficulty */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>产品类型</Label>
                    <Input
                      placeholder="如：iPhone 16 Pro"
                      value={uploadForm.product_type}
                      onChange={(e) =>
                        setUploadForm({ ...uploadForm, product_type: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>难度</Label>
                    <Select
                      value={uploadForm.difficulty}
                      onValueChange={(v) =>
                        setUploadForm({ ...uploadForm, difficulty: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 - 简单</SelectItem>
                        <SelectItem value="2">2</SelectItem>
                        <SelectItem value="3">3 - 中等</SelectItem>
                        <SelectItem value="4">4</SelectItem>
                        <SelectItem value="5">5 - 困难</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Outcome */}
                <div className="space-y-2">
                  <Label>交易结果</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={uploadForm.outcome === 'success' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setUploadForm({ ...uploadForm, outcome: 'success' })}
                    >
                      成功案例
                    </Button>
                    <Button
                      type="button"
                      variant={uploadForm.outcome === 'failure' ? 'destructive' : 'outline'}
                      size="sm"
                      onClick={() => setUploadForm({ ...uploadForm, outcome: 'failure' })}
                    >
                      失败案例
                    </Button>
                  </div>
                </div>

                {/* Conversation Text */}
                <div className="space-y-2">
                  <Label>对话内容（可选）</Label>
                  <Textarea
                    placeholder="粘贴关键对话内容..."
                    value={uploadForm.conversation_text}
                    onChange={(e) =>
                      setUploadForm({ ...uploadForm, conversation_text: e.target.value })
                    }
                    rows={3}
                  />
                </div>

                {/* Tags */}
                <div className="space-y-2">
                  <Label>标签（逗号分隔）</Label>
                  <Input
                    placeholder="如：bargainer, successful, iphone"
                    value={uploadForm.tags}
                    onChange={(e) =>
                      setUploadForm({ ...uploadForm, tags: e.target.value })
                    }
                  />
                </div>

                {/* Submit */}
                <Button
                  className="w-full"
                  onClick={handleUpload}
                  disabled={uploading || !uploadForm.title || uploadFiles.length === 0}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      上传中...
                    </>
                  ) : (
                    '上传案例'
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="搜索案例..."
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select
                value={filterCountry}
                onValueChange={setFilterCountry}
              >
                <SelectTrigger className="w-full md:w-[160px]">
                  <SelectValue placeholder="国家" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部国家</SelectItem>
                  {countries.map((country) => (
                    <SelectItem key={country.country_code} value={country.country_code}>
                      {country.country_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={filterProductType}
                onValueChange={setFilterProductType}
              >
                <SelectTrigger className="w-full md:w-[160px]">
                  <SelectValue placeholder="产品类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部类型</SelectItem>
                  {productTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={filterDifficulty}
                onValueChange={setFilterDifficulty}
              >
                <SelectTrigger className="w-full md:w-[140px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="难度" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部难度</SelectItem>
                  <SelectItem value="1">简单</SelectItem>
                  <SelectItem value="2">中等</SelectItem>
                  <SelectItem value="3">困难</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Cases List */}
        <div className="grid gap-4 md:grid-cols-2">
          {cases.map((c) => {
            const diff = getDifficultyLabel(c.difficulty);
            return (
              <Card key={c.id} className="bg-card">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">{c.title}</CardTitle>
                    <Badge className={diff.color}>{diff.text}</Badge>
                  </div>
                  <CardDescription className="line-clamp-2">
                    {c.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-1">
                    {c.tags?.slice(0, 4).map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {c.product_type}
                    </span>
                    <div className="flex items-center gap-3 text-muted-foreground">
                      {c.screenshots?.length > 0 && (
                        <span className="flex items-center gap-1">
                          <ImageIcon className="h-3 w-3" />
                          {c.screenshots.length}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {c.practice_count}
                      </span>
                      {c.avg_similarity_score !== null && (
                        <span className="flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" />
                          {c.avg_similarity_score}%
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleViewCase(c)}
                    >
                      查看详情
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => handleStartPractice(c)}
                    >
                      开始练习
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {cases.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <BookOpen className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-muted-foreground">暂无案例</p>
            </CardContent>
          </Card>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={handlePageSizeChange}
            pageSizeOptions={[10, 20, 50]}
          />
        )}

        {/* Case Detail Dialog */}
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedCase?.title}</DialogTitle>
              <DialogDescription>{selectedCase?.description}</DialogDescription>
            </DialogHeader>
            {selectedCase && (
              <div className="space-y-4 pt-2">
                {/* Screenshots */}
                {selectedCase.screenshots?.length > 0 && (
                  <div className="space-y-2">
                    <Label>交易截图</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {selectedCase.screenshots.map((key) => (
                        <img
                          key={key}
                          src={screenshotUrls[key] || ''}
                          alt="Case screenshot"
                          className="w-full rounded-lg border border-border object-cover aspect-video"
                        />
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Badge className={getDifficultyLabel(selectedCase.difficulty).color}>
                    {getDifficultyLabel(selectedCase.difficulty).text}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {selectedCase.product_type}
                  </span>
                </div>

                {selectedCase.tags && selectedCase.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {selectedCase.tags.map((tag) => (
                      <Badge key={tag} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Conversation Data */}
                {selectedCase.conversation_data && selectedCase.conversation_data.length > 0 && (
                  <div className="space-y-2">
                    <Label>对话记录</Label>
                    <div className="bg-muted rounded-lg p-3 text-sm space-y-1 max-h-48 overflow-y-auto">
                      {selectedCase.conversation_data.map((msg, i) => (
                        <div key={i} className={msg.role === 'buyer' ? 'text-blue-400' : 'text-green-400'}>
                          <span className="font-semibold">{msg.role === 'buyer' ? '买家' : '卖家'}:</span> {msg.content}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Key Moments */}
                {selectedCase.key_moments && selectedCase.key_moments.length > 0 && (
                  <div className="space-y-2">
                    <Label>关键时刻</Label>
                    <div className="bg-muted rounded-lg p-3 text-sm space-y-1 max-h-32 overflow-y-auto">
                      {selectedCase.key_moments.map((moment, i) => (
                        <div key={i}>
                          <span className="text-yellow-400 font-semibold">{moment.type}:</span> {moment.description}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Best Responses */}
                {selectedCase.best_responses && selectedCase.best_responses.length > 0 && (
                  <div className="space-y-2">
                    <Label>最佳回复</Label>
                    <div className="bg-muted rounded-lg p-3 text-sm space-y-1 max-h-32 overflow-y-auto">
                      {selectedCase.best_responses.map((resp, i) => (
                        <div key={i}>
                          <span className="text-green-400 font-semibold">{resp.scenario}:</span> {resp.response}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button
                    className="flex-1"
                    onClick={() => {
                      setDetailOpen(false);
                      handleStartPractice(selectedCase);
                    }}
                  >
                    开始练习
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
