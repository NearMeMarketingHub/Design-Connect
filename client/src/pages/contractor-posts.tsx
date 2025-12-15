import { useState, useRef } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Plus, 
  X, 
  Image as ImageIcon, 
  Calendar,
  MessageCircle,
  Heart,
  ArrowLeft,
  Trash2,
  Eye
} from "lucide-react";

export default function ContractorPosts() {
  const { projectId } = useParams<{ projectId: string }>();
  const queryClient = useQueryClient();
  
  const [createPostOpen, setCreatePostOpen] = useState(false);
  const [newPostTitle, setNewPostTitle] = useState("");
  const [newPostCaption, setNewPostCaption] = useState("");
  const [newPostImages, setNewPostImages] = useState<string[]>([]);
  const [previewPost, setPreviewPost] = useState<any | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewImageIndex, setPreviewImageIndex] = useState(0);
  
  const postImageInputRef = useRef<HTMLInputElement>(null);

  const { data: posts = [] } = useQuery<any[]>({
    queryKey: ['/api/projects', projectId, 'posts'],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/posts`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!projectId
  });

  const createPostMutation = useMutation({
    mutationFn: async (postData: { title: string; caption: string; images: string[] }) => {
      const res = await fetch(`/api/projects/${projectId}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: postData.title,
          caption: postData.caption,
          coverImage: postData.images[0],
          images: postData.images,
          creatorName: 'Contractor'
        })
      });
      if (!res.ok) throw new Error('Failed to create post');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'posts'] });
      setCreatePostOpen(false);
      setNewPostTitle("");
      setNewPostCaption("");
      setNewPostImages([]);
    }
  });

  const deletePostMutation = useMutation({
    mutationFn: async (postId: string) => {
      const res = await fetch(`/api/posts/${postId}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to delete post');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'posts'] });
    }
  });

  const handlePostImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    const remainingSlots = 10 - newPostImages.length;
    const filesToAdd = Array.from(files).slice(0, remainingSlots);
    
    filesToAdd.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        setNewPostImages(prev => [...prev, dataUrl]);
      };
      reader.readAsDataURL(file);
    });
    
    if (postImageInputRef.current) {
      postImageInputRef.current.value = '';
    }
  };

  const openPreview = (post: any) => {
    setPreviewPost(post);
    setPreviewImageIndex(0);
    setPreviewOpen(true);
  };

  const projectName = projectId === 'jenkins' ? 'Jenkins Residence' : 
                      projectId === 'miller' ? 'Miller Kitchen' : 
                      projectId === 'westlake' ? 'West Lake Build' : 'Project';

  return (
    <div className="space-y-6">
      <input 
        type="file" 
        ref={postImageInputRef}
        className="hidden"
        accept="image/*"
        multiple
        onChange={handlePostImageUpload}
      />
      
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin-dashboard">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Link>
        </Button>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Progress Updates</h1>
          <p className="text-muted-foreground mt-1">{projectName} - Share project progress with clients</p>
        </div>
        <Button onClick={() => setCreatePostOpen(true)} data-testid="button-create-post">
          <Plus className="w-4 h-4 mr-2" />
          Create Post
        </Button>
      </div>

      {posts.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <ImageIcon className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Progress Updates Yet</h3>
            <p className="text-muted-foreground mb-4">
              Start sharing progress photos and updates with your clients.
            </p>
            <Button onClick={() => setCreatePostOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Post
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.map((post) => (
            <Card key={post.id} className="overflow-hidden group">
              <div className="aspect-video relative">
                <img 
                  src={post.coverImage} 
                  alt={post.title}
                  className="w-full h-full object-cover"
                />
                {post.images && post.images.length > 1 && (
                  <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
                    +{post.images.length - 1} more
                  </div>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                  <Button 
                    size="sm" 
                    variant="secondary"
                    onClick={() => openPreview(post)}
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    Preview
                  </Button>
                  <Button 
                    size="sm" 
                    variant="destructive"
                    onClick={() => {
                      if (confirm('Are you sure you want to delete this post?')) {
                        deletePostMutation.mutate(post.id);
                      }
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <CardContent className="p-4">
                <h3 className="font-semibold text-lg mb-1">{post.title}</h3>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{post.caption}</p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Heart className="w-3 h-3" />
                      {post.reactionCount || 0}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle className="w-3 h-3" />
                      {post.commentCount || 0}
                    </span>
                  </div>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(post.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Post Dialog */}
      <Dialog open={createPostOpen} onOpenChange={setCreatePostOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Progress Update</DialogTitle>
            <DialogDescription>
              Share photos and updates about the project progress. You can add up to 10 images.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Title</label>
              <Input
                placeholder="e.g., Kitchen Framing Complete"
                value={newPostTitle}
                onChange={(e) => setNewPostTitle(e.target.value)}
                data-testid="input-post-title"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Caption</label>
              <Textarea
                placeholder="Describe the progress update..."
                value={newPostCaption}
                onChange={(e) => setNewPostCaption(e.target.value)}
                className="min-h-[100px]"
                data-testid="input-post-caption"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Photos ({newPostImages.length}/10)</label>
              <div className="grid grid-cols-5 gap-2">
                {newPostImages.map((img, idx) => (
                  <div key={idx} className="relative aspect-square group">
                    <img 
                      src={img} 
                      alt={`Upload ${idx + 1}`}
                      className="w-full h-full object-cover rounded-lg"
                    />
                    <button
                      className="absolute top-1 right-1 bg-black/60 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => setNewPostImages(prev => prev.filter((_, i) => i !== idx))}
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ))}
                {newPostImages.length < 10 && (
                  <button
                    onClick={() => postImageInputRef.current?.click()}
                    className="aspect-square border-2 border-dashed border-muted-foreground/30 rounded-lg flex flex-col items-center justify-center hover:border-muted-foreground/50 transition-colors"
                    data-testid="button-add-post-image"
                  >
                    <Plus className="w-6 h-6 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground mt-1">Add</span>
                  </button>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setCreatePostOpen(false);
              setNewPostTitle("");
              setNewPostCaption("");
              setNewPostImages([]);
            }}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (newPostTitle.trim() && newPostImages.length > 0) {
                  createPostMutation.mutate({
                    title: newPostTitle.trim(),
                    caption: newPostCaption.trim(),
                    images: newPostImages
                  });
                }
              }}
              disabled={!newPostTitle.trim() || newPostImages.length === 0 || createPostMutation.isPending}
              data-testid="button-publish-post"
            >
              {createPostMutation.isPending ? 'Publishing...' : 'Publish'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          {previewPost && (
            <div className="flex flex-col md:flex-row h-[80vh]">
              <div className="flex-1 bg-black flex items-center justify-center relative">
                <img 
                  src={previewPost.images?.[previewImageIndex] || previewPost.coverImage}
                  alt={previewPost.title}
                  className="max-w-full max-h-full object-contain"
                />
                {previewPost.images && previewPost.images.length > 1 && (
                  <>
                    <button
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2"
                      onClick={() => setPreviewImageIndex(i => Math.max(0, i - 1))}
                      disabled={previewImageIndex === 0}
                    >
                      ←
                    </button>
                    <button
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2"
                      onClick={() => setPreviewImageIndex(i => Math.min(previewPost.images.length - 1, i + 1))}
                      disabled={previewImageIndex === previewPost.images.length - 1}
                    >
                      →
                    </button>
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1">
                      {previewPost.images.map((_: string, idx: number) => (
                        <button
                          key={idx}
                          className={`w-2 h-2 rounded-full ${idx === previewImageIndex ? 'bg-white' : 'bg-white/50'}`}
                          onClick={() => setPreviewImageIndex(idx)}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
              <div className="w-full md:w-80 p-6 bg-card overflow-y-auto">
                <h2 className="text-xl font-bold mb-2">{previewPost.title}</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  {new Date(previewPost.createdAt).toLocaleDateString()}
                </p>
                <p className="text-sm">{previewPost.caption}</p>
                <div className="mt-6 pt-4 border-t flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Heart className="w-4 h-4" />
                    {previewPost.reactionCount || 0} likes
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageCircle className="w-4 h-4" />
                    {previewPost.commentCount || 0} comments
                  </span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
