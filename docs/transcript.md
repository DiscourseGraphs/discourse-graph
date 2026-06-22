Impromptu Zoom Meeting - May 29
VIEW RECORDING - 100 mins (No highlights): https://fathom.video/share/V8D3sohiH1gCYMdY7JtZXiYN2GARz8Cz

---

0:01 - Marc-Antoine Parent
Sorry, I'll need to take a few notes from, I was just meeting with Luke about something.

0:06 - Michael Gartner (mclicks@gmail.com)
Yeah, no, go ahead. I'm still, I'm still kind of setting up here.
SCREEN SHARING: Discourse started screen sharing - WATCH: https://fathom.video/share/V8D3sohiH1gCYMdY7JtZXiYN2GARz8Cz?timestamp=56.561979

0:10 - Marc-Antoine Parent
Okay, cool. Okay. Thank you. I'm thinking, just before we begin.

1:00 - Michael Gartner (mclicks@gmail.com)
Quick, quick.

1:00 - Marc-Antoine Parent
Go ahead. I'm thinking of creating a GitHub for the MIRA schema work, like here's the prototype schema we agreed on so far, here's a turtle, here's a JSON-LD, so that people can do pull requests against it. Should I do it in the discourse graph organization, but it's something I need to be, you know, I need to be able to invite people easily, or should I do it in one eye control, because I don't have permissions. to invite people, for example, or should I ask the MIRA people to set it up?

1:37 - Michael Gartner (mclicks@gmail.com)
Yeah, I don't know, like, if it were me, I would decide probably there and see what everyone else is thinking about.

1:43 - Marc-Antoine Parent
create it before we are there. I want to have something ready this weekend.

1:50 - Michael Gartner (mclicks@gmail.com)
Okay. Yeah, I mean, I would ask Matt and Joval, they have all the access capabilities, so you're kind of working directly with them, I would... see what they think would be best.

2:02 - Marc-Antoine Parent
Okay. I'll ask them. I'll ask Joel now after we talk.

2:10 - Michael Gartner (mclicks@gmail.com)
Yeah. So for this, all I had was going through the scoping of these two documents. So I have a content model. That's the one that I'm more interested in today. If we get to the other one today, that'd be good. But if we don't, that's fine. And so really just reading through it. And if you can flag anything that you see is doesn't make sense, is no good, should change, et cetera, et cetera. So that's really all this is. Not a lot of fun, but kind of what has to be done. So the content model is just the adjson. Yeah.

2:49 - Marc-Antoine Parent
Should I read it, I think, and we should meet again? Sorry. Because I'm thinking, is my reading it with you useful? It's up to you.

2:58 - Michael Gartner (mclicks@gmail.com)
Like, cause I can skim some parts. So it's not a lot of craziness, but there's a couple pieces that I might tag you in to say, hey, does this make sense? Is there something wrong here? Or just as you're going through it, to say, listen, this doesn't make sense, or we need to change X or Y, as it relates to the database or different things that are being proposed. So it could go pretty quick.

3:21 - Marc-Antoine Parent
Okay, let me try to speed read it.

3:24 - Michael Gartner (mclicks@gmail.com)
Okay, or we could do it together.

3:26 - Marc-Antoine Parent
I mean, it's up to you. Sure.

3:30 - Michael Gartner (mclicks@gmail.com)
This for the V0 for content model is literally just dual writing, no dual reading, no doing anything. Just when we upload for Obsidian or Roam, we're also doing a at JSON at the same time. That's what V0 is, which we'll move on to reading said at JSON. But right now storing separately with adding a content dot content type. So that's where I would definitely need your opinion. Like, is that right? Obviously, we're going to keep very in. It says separate, those are semantic content slices, but content.type would be markdown or at.json or what have you.

4:08 - Marc-Antoine Parent
Do you see them coexisting in the sense, do you think there will be two content types for the same slice, or is it one or the other? I'm asking about uniqueness keys here.

4:22 - Michael Gartner (mclicks@gmail.com)
It would have to be a uniqueness key, but whether or not we actually always have it is another question. I think that's in the open questions of like, do we want, for example, the native content always there? I don't know yet. I'm not even, maybe, maybe not. I think initially, no, I don't think we need it. It would only, if the need shows itself that it's faster for X, Y, whatever, if we're doing a ton of writes for whatever reason, stuff like that, then yes. Otherwise, probably not.

4:53 - Marc-Antoine Parent
Yeah, my intuition is we should have it only once, be dry as much as possible, and. So I would keep it unique, but there will be a transition period, basically, where we'll have Obsidian working on the old pure content and maybe also Roam, each with their pure content, and then we'll slowly introduce AdJSON. And for the transition period, that means I need to change the unique key, which I'm happy to.

5:19 - Michael Gartner (mclicks@gmail.com)
It'd have to include content type, yeah.

5:22 - Marc-Antoine Parent
I think so. Okay, so that's easy. I think we agree. We want, eventually, to converge to single content type. But, it will create a lot of headaches, by the way. Because, oh, I want to update and sync. Oh, how many of the content types already exist? Then I need to update both. That kind of nonsense. Are we, when are we updating both? Where are we updating one? Like, update if exists? I don't know.

5:57 - Michael Gartner (mclicks@gmail.com)
It's... I think, think, from my mental... And I haven't dug deep enough into this yet, but I'm going to get the content out of the host application and then transform it. So I should only have to get it once. And then we could do a read to see like, okay, what do I need to update? But at that time I transform it, I don't have to read it again from the host application.

6:23 - Marc-Antoine Parent
No, that's not what I'm thinking about. It's about the usual transition problem, right? Meaning this is not a web application. We cannot ensure that all changes are simultaneous for all clients. So that if, right now, Obsidian sync depends on there being Obsidian content. When we add adjacent content, it will be, it has to be in parallel, so that an old Obsidian who syncs can still retrieve the Obsidian content. And that means that for the transition period, a new The Obsidian Sinker, Pusher, will have to push both so that the old one can read the old Obsidian content and the new one can choose to prefer the AdJSON one. You see what I'm saying?

7:16 - Michael Gartner (mclicks@gmail.com)
Sorry, you said it has to push both?

7:19 - Marc-Antoine Parent
Yes, because the old Obsidian clients will want the old format, and the new Obsidian clients will want the new format, or Rome will want the new format. And so a new Obsidian plugin has to push both the AdJSON and the Obsidian in transition until all the old Obsidian clients are dead.

7:50 - Michael Gartner (mclicks@gmail.com)
Yeah.

7:51 - Marc-Antoine Parent
Unless, unless, we start... Reading, not directly from the database, but from a Next.js intermediate function, which we can change globally so that it always gives the native format of the asking application.

8:14 - Michael Gartner (mclicks@gmail.com)
Yeah, it could handle the translation layer there.

8:20 - Marc-Antoine Parent
Yeah, and then we'd have only one in the database. I like that solution, actually. Maybe start rethinking about the readers, the sync readers, so that they always go through at a hub, at a Next.js hub, that will eventually ensure translation.

8:49 - Michael Gartner (mclicks@gmail.com)
Yeah, I think I'm partial to that as well.

9:04 - Marc-Antoine Parent
And then we wouldn't ever need duplicates. There would only ever be one content type.

9:39 - Michael Gartner (mclicks@gmail.com)
There'd only ever be one content type. Okay, let's walk through this. So there's already Markdown in place. If a person is importing before it's been updated, then there still is only Markdown in place. Are we saying we're going to transform that Markdown? Or do we need, I don't think we can, right? We need additional information from the host application to have.

10:11 - Marc-Antoine Parent
Basically, I'm a new Obsidian plugin. Or even I'm a no, like right now, everything old enough to not go through Next is kind of dead in the water. So we'll have to have that transition. So that's one thing. And that's urgent. But from now on, all upserts, all downloads are through Next. That's it. And if you're an old-style plugin, a medium-style plugin that knows to go through Next, you upload, say, Obsidian, and then let's say for now it gets uploaded as Obsidian because we're still in, we're not there, we're not in this phase yet. We're still doing old-style stuff. And. So when you're downloading, the thing is like, oh, you're an Obsidian plugin asking. You're asking. You say, I want Obsidian format. And then the next JS downloader looks for, oh, it's already Obsidian format. Pass through. Or at some point, oh, no, it's not Obsidian format. It's at JSON. Translate. And same thing with the upload. You upload as a medium stage plugin, then you upload Obsidian, and then the translation layer will say, okay, no, let's change that to at JSON. Kill, if there was Obsidian data, kill it. And there's only one.

11:39 - Michael Gartner (mclicks@gmail.com)
So I think the problem lies when you have Rome trying to download an already uploaded Obsidian, then there's a conflict there.

11:50 - Marc-Antoine Parent
No, the idea is, Rome, let's assume that we've done a transition. Where at this point, Obsidian and Roam always go through the next JS endpoints. That's a big assumption.

12:08 - Michael Gartner (mclicks@gmail.com)
Yep.

12:09 - Marc-Antoine Parent
So, but let's say that we go in phases and that JSON comes quite after the first project, which is the JSON Roam translation, where Roam will put its own markdown, Roam markdown versus Obsidian markdown. And that's explicit in the content type. So, right now, Obsidian pushes, Obsidian markdown, Roam pushes Roam markdown. And when it calls, it says, hey, I want Obsidian markdown. And the next JS layer will look, you want Obsidian markdown. I have Obsidian markdown pass-through. I have Roam markdown, I don't know how to translate that yet, pass-through. Or maybe I do, and I'll do a few adjustments, translate. Or, hey, look, it's at JSON now, because some fresh thing did at JSON. So, I can translate to Obsidian markdown. Because that's what you asked me. So the idea is the plugin asks the download endpoint, here's the format I want. And then the download endpoint does whatever translation is required, given what is there. And the upload can upload whatever, because it will be translated. Again, at the upload layer, you will soon enough, we'll be able to say whatever you upload, I'll store at JSON.

13:39 - Michael Gartner (mclicks@gmail.com)
Yeah, I think there's a couple things here. I think we're conflating like Obsidian Markdown, Roam Markdown, and Roam Proper and Obsidian Proper. I'm not sure what Obsidian Proper is, but it's probably different than Obsidian Markdown. What? Maybe. No. No, Obsidian.

14:05 - Marc-Antoine Parent
Right now what we're storing is Obsidian Markdown.

14:09 - Michael Gartner (mclicks@gmail.com)
Unless we want to store more things like creator, edited, things like that, that's not in Markdown that we maybe want to store in as metadata.

14:21 - Marc-Antoine Parent
I don't know. We store other fields of the content and concept tables. Yes, sure. But what I mean is what goes in the text field is Obsidian Markdown. And the metadata goes in the content metadata field.

14:38 - Michael Gartner (mclicks@gmail.com)
But without JSON, the metadata is often mixed in with the content. Yes.

14:43 - Marc-Antoine Parent
It's not separate.

14:45 - Michael Gartner (mclicks@gmail.com)
So we can have a higher fidelity without JSON than we could with Obsidian Markdown, for example.

14:53 - Marc-Antoine Parent
I approve totally. No, no. We want to go towards our JSON. That is not in question. What I'm saying is as a way to... To mitigate the nightmare that is versioning, let's have one versioning cost where everybody accesses the database through Next.js endpoints, and then the Next.js endpoints can evolve to say, whatever I'm getting, I'm serving at JSON, whatever I'm finding in the database, I'm returning whatever native thing that the platform wants. The translation happens at the Next.js endpoint, nowhere else, which I think is ideal, because it's done once, and there's no versioning there. Like, the platforms send their native, receive their native, and all the translation is done at the Next.js level.

15:46 - Michael Gartner (mclicks@gmail.com)
Yeah, maybe. I think that's one option. I'd have to look, because I don't know the database structure well enough to know, like, can we call the content to say return both at JSON and markdown if we have them, and then based on what We return, use them. So maybe the next.js hop isn't actually as beneficial as it could be. I'd have to double check that. I think if we go into down here, so maybe we should just go through this. down here, there is a, and I haven't updated the milestone. Let's give me one second. The, this isn't it. This one, there's two. That's great. Okay. At the end here to hold on.

17:02 - Marc-Antoine Parent
By the way, I'm pretty much done with the function that upsurge everything. That was this morning. Of course, using it is another stage, but it does what we want.

17:16 - Michael Gartner (mclicks@gmail.com)
So here I'm talking about the API representation negotiation being deferred, but I think you're kind of moving it forward. Is that what I'm doing?

17:24 - Marc-Antoine Parent
Moving it at the forefront. Yes, absolutely. And the reason I want to do that is that it's about avoiding versioning in the platform plugins because versioning of the platform plugins is a nightmare.

17:39 - Michael Gartner (mclicks@gmail.com)
Where are you seeing that you would need versioning?

17:43 - Marc-Antoine Parent
Like, look at the versioning we had to do for unified relations in Roe. You know, it's, oh, we have people using the old system, people using the new system. So we transfer things, but we allow people to use the old thing. And then at some point when the old things, people stop using the old thing, we'll be able to do this. Like there's all these stages of we're doing a change. So we allow the new thing to exist, but the old thing has to keep working for people who have the old version of the plugin. And then someday maybe we'll know that people are no longer using an old plugin. We can kill the old version. This is a nightmare. This is something we don't have to deal with in the web, ever. You just change things for people. They don't know. So putting all the translation layer at the web level is an incredible benefit.

18:53 - Michael Gartner (mclicks@gmail.com)
I'd have to take some time to think more through this. Like I don't have a strong aversion to it, depending on how... How much extra work the content negotiation might be comparatively, but I'd have to scope that out, I think.

19:07 - Marc-Antoine Parent
It's okay, but I think it's much less work. The idea is there's only ever one format in the database. Old applications will start with Roam markdown and Obsidian markdown because pre-add JSON phase one. And we'll put it appropriately in the content, but there's only ever one. And the first version of the API will just pass it through with minimal translation. Maybe there'll be translation, maybe not, but basically the plugin will say, I want this. Oh, the next JSON find the database contains this. I may or may not have to translate and either pass through or translate. That's now step zero or step one, because step zero is getting everybody. And then, we introduced that JSON, and then basically the uploader endpoint goes, oh, Roam is giving me Roam Markdown, I'll make it at JSON. Obsidian is giving me Obsidian Markdown, I'll make it at JSON. And maybe at some point, the new Roam plugin will just send Roam JSON.

20:30 - Michael Gartner (mclicks@gmail.com)
I think there's a problem right now where, because Roam and Obsidian Markdown are lower fidelity, you can't convert them to at JSON. I think that's the whole point of having the at JSON storage format in the first place, is that it is higher fidelity, but we're not storing that fidelity currently.

20:49 - Marc-Antoine Parent
no, no, no, no, no, no. I agree for Roam, not for Markdown, not for Obsidian, but the Obsidian Markdown is Obsidian format. Obsidian is Markdown. Now. Now. So there's no loss of fidelity there. What is in the database is exactly what's in the vault. No more, no less. There's no translation step, just a storage step. That's not true about Obsidian. In the case of Roam, I agree totally, but this is why we did agree we would have a step zero of the other project where we'd store Roam markdown as a way to get a fast track to Roam Obsidian combat. So that will be our step zero of the other project. So for a while, we'll be storing Roam markdown, low fidelity, fully agreed in the database, okay? Then we do the V0 of this project, which is everybody goes through the next JS endpoints instead of directly speaking to Superbase, trivial. And then the Roam starts sending Roam JSON instead of Roam. So Roam Markdown, which means that the next endpoint will be able to do a much better translation to add JSON from Roam JSON instead of Roam Markdown. So there you'll have the gain of fidelity, but that's purely at the database level. So basically, the old plugins will keep sending low fidelity. The old Roam plugins will keep sending low fidelity Roam Markdown. New plugins will send new high fidelity pure Roam, and progressively, the new plugins will outgrow the old plugins. So the presence of Roam Markdown in the database will decrease. Maybe we'll want to do something such that if there's old and new plugins pre-existing, we'll give priority to the new plugins, which give higher fidelity stuff. But that's from the endpoint point of view, it's not relevant. The endpoint is receiving something, whatever it is, can be Roam Markdown, Obsidian Markdown, Roam JSON, translate it to AdJSON, store it as in the database. The database will very soon only contain AdJSON, whereas it contained either, the endpoint can receive anything, and then it stores AdJSON. And then the read endpoint will convert whatever it finds, maybe it comes from an old plugin, so it's still Roam Markdown, Obsidian Markdown, even Roam JSON, convert it to, say, Obsidian Markdown, if that's what's being asked. You're asking, okay, I want Roam JSON. Okay, cool. I'll transform to Roam JSON from whatever it is. Maybe it's Obsidian Markdown. It came from an old plugin, so it's still stored as Obsidian Markdown, and it wasn't re-imported since, so it's still legacy format. the a3000 app ... We're So it doesn't matter. The reading endpoint knows, oh, Obsidian Markdown, to add JSON, to roam JSON, that's what you want, that's what you get. So from the platform point of view, you send whatever you want, you receive whatever you ask for, and all the translation happens in the next layer, next JS layer, which knows about all the translations. But it always stores at JSON when it can, from the highest quality content it receives. Low quality from an old plugin, high quality from a new old plugin. Obsidian, no difference. It's always Obsidian.

24:44 - Michael Gartner (mclicks@gmail.com)
In terms of changing the database structure, so here I had content type. Now with what you're proposing, do we still need and want that content type?

24:59 - Marc-Antoine Parent
Absolutely.

24:59 - Michael Gartner (mclicks@gmail.com)
Absolutely. In here, I didn't have, I just had Markdown, but we'd have to have, like, Obsidian Markdown versus Role Markdown, probably, too.

25:08 - Marc-Antoine Parent
Yes, absolutely.

25:13 - Michael Gartner (mclicks@gmail.com)
I don't generally see anything really wrong with that. I just would like to take some more time to fully understand the scoping comparatively. But I think I'm leaning toward what you're saying.

25:27 - Marc-Antoine Parent
No, I'm very happy I thought of that. It's like, oh, my God, we'll make things so much easier. I mean, we have to, what, the good thing about this is that we can start writing those endpoints now, which will be almost no-ops at the beginning. Start changing the platform's plugins now so they use those endpoints, and then that will make the rest of the change easy. But the endpoints should be totally. So transparent no-ops first, and then eventually they'll become more elaborate.

26:07 - Michael Gartner (mclicks@gmail.com)
Yeah. Okay. Okay. Cool. Let's power through this and see how is that for size. Can you read that?

26:41 - Marc-Antoine Parent
Yeah.

26:42 - Michael Gartner (mclicks@gmail.com)
Too big, too small? Okay.

26:44 - Marc-Antoine Parent
It could be smaller.

26:46 - Michael Gartner (mclicks@gmail.com)
Okay. I'll go down to 150 and we know how that looks.

26:50 - Marc-Antoine Parent
Yeah.

26:51 - Michael Gartner (mclicks@gmail.com)
Okay. These notes are in the branch. I think I'm trying to convert most of them into this. This document themselves are just kind of reference for me. So don't worry about those. So yeah, we're going to add a discourse graph at JSON to the canonical storage representation while preserving what's happening currently with Markdown Obsidian. So nothing breaks problem. Discourse graph only stores Markdown, but does not persist a portable content model that can later do Obsidian, Rome, website, et cetera. So we're going to add content type. seems like we're in agreement with that. We're going to keep variant as a semantic slice. We're in agreement with that. And we're going to write canonical DG at JSON alongside existing Markdown. So now this has kind of changed from what we're talking about. So we could actually just write rather than write both.

27:44 - Marc-Antoine Parent
Yep.

27:48 - Michael Gartner (mclicks@gmail.com)
How do I want to write that?

27:56 - Marc-Antoine Parent
Keep it as option alternatives. Because you're not this, you're not, you haven't decided, but yeah, I'm certainly highly in favor of, and that means I don't need to change the unique key, which I'm happy with, not, not because of its work, I don't care.

28:14 - Michael Gartner (mclicks@gmail.com)
But wouldn't you still have to change the unique key because it has to include content type?

28:19 - Marc-Antoine Parent
Nope, there would be only one, there, there would never be two content types coexisting.

28:26 - Michael Gartner (mclicks@gmail.com)
Right, okay. Okay, or overwrite with new, if you can make over each one. Okay. Yeah, and the database canonical at JSON can be rolled out without interrupting the current behavior. Yeah. Goals, non-goals. So there's a lot of repeating stuff in here, too. So that's why I think we can skim a lot of it. Write only canonical at JSON storage or discourse graphs in a way that keeps things working. This is a repeat. This is a repeat. Here's what I've listed for the JSON. Let me know if you want to the vendor discourse graph at JSON.

29:21 - Marc-Antoine Parent
we said we said we'd have text markdown plus Obsidian, text markdown plus Rome. Actually, it's probably the other one. It's Rome plus Markdown and Obsidian. It's Markdown comes second. Like this? No, no, after the slash. It's confusing, but...

30:11 - Michael Gartner (mclicks@gmail.com)
Cool, cool, cool.

30:13 - Marc-Antoine Parent
And eventually we'll have application-roam-plus-json.

30:21 - Michael Gartner (mclicks@gmail.com)
Sorry, can you expand on that?

30:24 - Marc-Antoine Parent
Application-roam-plus-json. For the json-roam, not as a storage value, but as an output value. Like the roam plugin will send that and it will be converted to addjson again at Next.js level. But it will, roam will not have to worry about addjson. Nobody, the plugins won't use addjson. They won't know about it. All translation will be done at the edge.

31:08 - Michael Gartner (mclicks@gmail.com)
Yeah. Keep contact text as drive plain text for semantic search, et cetera, et cetera. Obsidian still playing markdown, pair atjson to obsidian and atjson renderers. Non-goals replacing obsidian markdown for v0.

31:31 - Marc-Antoine Parent
I guess that's not true anymore.

31:33 - Michael Gartner (mclicks@gmail.com)
Yeah. It's going to be true if we do this first. Do not make destination readers prefer atjson in v0 also. They would prefer because we're ready to. Next, yes, first. No.

32:00 - Marc-Antoine Parent
They'll ask, they'll prefer whatever their native format is.

32:03 - Michael Gartner (mclicks@gmail.com)
But there's a preference order. Oh. I don't know if I want to write that in, because isn't the preference always, we're expecting at JSON, that's going to be the end state, so we're preferring that and doing translation. Yes, it'll be an extra translation, if it is the fact that we do have their native platform there, but we're not expecting.

32:27 - Marc-Antoine Parent
No, no, no, no, no, no. The reader, the platform plugin reader, always asks for its preferred format, which is its native format. And the translation from at JSON is done, again, at the Edge. So the Edge provides from at JSON to the native format of the platform.

32:49 - Michael Gartner (mclicks@gmail.com)
Right, I guess I'm thinking, like, I agree with you. It's more just like in order of which they're looking. So I think I'm just talking about something slightly different.

32:58 - Marc-Antoine Parent
Yeah, yeah, yeah. not the destination reader, it's the edge function refers at JSON.

33:08 - Michael Gartner (mclicks@gmail.com)
Yeah. Okay. Do not port same page wholesale. Do not introduce same page, blah, blah, blah, blah, blah. All this stuff is just additional. This is a lot coming from the fact that we were in this conversation with the LLM back and forth using same page as the basis that we're working off of. Don't serialize that JSON into text. Don't embed that JSON into text. Do not introduce another content variant and do not make Markdown a final cross app canonical format. So that's interesting. From what I'm hearing you saying, if you only want an individual, like a single stored text value, then having like the native version. I thought that's something you were leaning toward before, but I'm guessing in light of this new revelation is that's kind of where you want to go. Okay.

33:55 - Marc-Antoine Parent
Approach. Yeah. Yeah.

33:56 - Michael Gartner (mclicks@gmail.com)
Okay. Cool. No, that's fine by me. Yeah. In scope, add content type. Backfill was four, but now do we need it? I'm trying to think of this new approach.

34:12 - Marc-Antoine Parent
Yes, we do.

34:15 - Michael Gartner (mclicks@gmail.com)
But backfill was only if we actually listed a new content type, which we're not.

34:20 - Marc-Antoine Parent
Well, we need to know that the obsidian, like some of them, by the way, will be just text-text, like all the titles, all the single, the direct will be pure text, where it's the obsidian full that will be.

34:37 - Michael Gartner (mclicks@gmail.com)
Yeah.

34:39 - Marc-Antoine Parent
And that will be obsidian. Yeah, but this is no longer true. Yeah, correct.

34:50 - Michael Gartner (mclicks@gmail.com)
I should just stop saying not sure if it's probably we're going to, but I just want to stay with it probably for like 20 minutes after this and just see if there's anything. Yeah. Yeah, but I, like I said, leaning towards what you're saying. Is there anything with file references that are an issue? So I don't know a lot about how the file reference stuff works and how it's also pointing to content rows, but I guess...

35:13 - Marc-Antoine Parent
The way we did file reference is we have, here's the original path in the obsidian file, here's the content hash, and it's indexed by content hash, it's content address, it's content address in the blob store. So you can have multiple paths that yield the same blob, and then you'll have basically this table that says, oh, this path goes to this blob, and this other path also goes to this blob. So if the path is replaced by the Roam path, or Roam however they designate, I think it's a Firebase URL, it's the same... Okay. Let's I don't think that makes a substantial difference. We have this thing that we find in the Obsidian document or in the Roam document or in whatever document that maps to this blob ID. Pretty robust.

36:16 - Michael Gartner (mclicks@gmail.com)
Some of the views have to be updated because we're changing content type.

36:21 - Marc-Antoine Parent
Correct.

36:21 - Michael Gartner (mclicks@gmail.com)
I had shared content constraints, plain, markdown, this, and the other ones we listed, which was, yeah, text row, markdown, and text row. Create a DGO and DG document canonical model for this, the type for the JSON. Write at JSON without changing. Unless we do this first, there's just so many, it should just point to one and whatever, actually some payloads in metadata content, store-derived text in link text, and test and manual validation. So I do want to add a lot of tests before making any giant changes. I want to get more into a pattern of doing that. I'm starting to work on some VTES stuff in another PR to get that habit and flex that muscle. So I approve that in this and out of scope at JSON preferred import. Yes. No, we're not importing as we just discussed at JSON to obsidian rendering at JSON to Rome rendering API. Content negotiation native export. It's a canonical stored content.

38:08 - Marc-Antoine Parent
I think I just simplified our problem so much.

38:11 - Michael Gartner (mclicks@gmail.com)
I think so.

38:12 - Marc-Antoine Parent
I think so. I'm so happy. I often say I'm not pulling my weight.

38:17 - Michael Gartner (mclicks@gmail.com)
Here, I'm pulling my weight. Continuous. Yeah, no, I hear you. I agree. Continuous sync or automatic background import. I don't agree that you're not pulling your weight, by the way. That's not what I was agreeing. Continuous sync or automatic background import exists. Yep. Okay. And this was deferred, but now we're kind of wrapping it into B1.

38:48 - Marc-Antoine Parent
Oh, God. That makes, that'll be a brief.

39:01 - Michael Gartner (mclicks@gmail.com)
Render parity tests. I mean, that doesn't really, we're not really doing a lot anyway there. could probably just skip this for, because we're just doing it for so simply now, HTML rendering. And this is depending on if it exists and if we're pursuing it. I'm interested to see what that looks like.

39:19 - Marc-Antoine Parent
We'll want tests that the round trip to add JSON is not losing any important characteristic of Obsidian or Rome. That'll be the tests. And that's going to be significant.

39:34 - Michael Gartner (mclicks@gmail.com)
And it looks like this not if we're not doing native format storage.

39:43 - Marc-Antoine Parent
By the way, I think, I think there's a scenario for the record. I'm just thinking now, given everything we've said, where until we know that the round trip is perfectly innocuous. We could do it totally another way and store whatever native format, so either RomeJSON or ObsidianMart now, translate through AppJSON where we're translating between formats, but otherwise, just use the native format and pass it through.

40:18 - Michael Gartner (mclicks@gmail.com)
It could work too. Yeah, I see.

40:25 - Marc-Antoine Parent
And it would be more efficient in many cases, actually. So it's a question, actually, which one we want.

40:37 - Michael Gartner (mclicks@gmail.com)
Do have a strong opinion either way?

40:40 - Marc-Antoine Parent
This I'd need to analyze, but my intuition is, there's less compute time if we have a shortcut in some cases, which means that storing native may be more economical in the long run.

40:55 - Michael Gartner (mclicks@gmail.com)
Native can also change. So I do like having control of our own. Knowing that if native changes, we'll adjust and we'll know that we have to adjust rather than it being adjusted for us, that could cause some issues.

41:09 - Marc-Antoine Parent
Good point. But then that's all the more reason to have a strong test suite.

41:14 - Michael Gartner (mclicks@gmail.com)
Mm-hmm. Yeah.

41:16 - Marc-Antoine Parent
Okay. I'm on board with that. I'm on board with that. It's good reason.

41:23 - Michael Gartner (mclicks@gmail.com)
Cool. So a lot of this... No, we went through that. Just going to close that one. In Scope use cases, Obsidian does what they're already doing. That's really all this is saying.

41:39 - Marc-Antoine Parent
Mm-hmm.

41:40 - Michael Gartner (mclicks@gmail.com)
Obsidian authored content is stored as canonical at JSON. Yes, this is both paths and it makes sense for both paths. Same with Roam is now stored as at JSON. Again, for both paths that we just described.

41:53 - Marc-Antoine Parent
Yep.

41:54 - Michael Gartner (mclicks@gmail.com)
Unless there's a list here that says double. Let me just double check. User creates. It's written as before. Is all

42:05 - Marc-Antoine Parent
But I do think I will make the point that native first and translate afterwards may be a good intermediate stage until we have, we know that the test suite is full. And it's again, something we can change whenever.

42:26 - Michael Gartner (mclicks@gmail.com)
And sorry, what's a good quick reason to say?

42:30 - Marc-Antoine Parent
What I said about let's store native for a while and do the translation only when we need to translate and go. Just resend the original data until we have the full test suite. I think what is nice is we have kind of a nice transition, which we can just flip a switch someday.

42:56 - Michael Gartner (mclicks@gmail.com)
That would be the benefit of storing both versions. So. So. So. So. So.

43:00 - Marc-Antoine Parent
No, would be, yeah, maybe, but we don't have to. See, we can start with storing native and then transition to storing adjson when we're confident the adjson is mature enough.

43:24 - Michael Gartner (mclicks@gmail.com)
I don't love it. When would we be confident? I mean, I guess the test suites, if they are robust enough?

43:33 - Marc-Antoine Parent
Exactly. There's a threshold where, yeah, we know that the test suites are good enough. Okay.

43:43 - Michael Gartner (mclicks@gmail.com)
I think we can revisit that if it is the case that the test suites don't seem to be pulling their weight. I think I'm going to assume that they will rather quickly for an 8020 that we want. I think that's my mental model, but I could be wrong.

43:59 - Marc-Antoine Parent
Yeah. My mental model is we can go with native. We can have a whole functioning system with native until then, with native storage until then.

44:09 - Michael Gartner (mclicks@gmail.com)
I wrote it in the meeting notes here, so we can tell you the whole test.

44:16 - Marc-Antoine Parent
And with Rome.js, which is higher fidelity. So that gives us another intermediate step.

44:31 - Michael Gartner (mclicks@gmail.com)
Number four, engineers validate before rollout, which is kind of what we're just talking about. Constraints, a lot of more repeats here too. Obsidian must still work, adjson will be alongside. So now we're saying.

44:50 - Marc-Antoine Parent
Can you teach your LLM about dry? Right? Yeah.

44:55 - Michael Gartner (mclicks@gmail.com)
There's a lot of work to do on getting this.

45:01 - Marc-Antoine Parent
Yeah, I agree.

45:03 - Michael Gartner (mclicks@gmail.com)
I think a big reason, a big thing I want to do here that I saw last time as well is being able to block reference, because then you can write it once and just refer to it, so.

45:14 - Marc-Antoine Parent
Yes, no kidding. By the way, I'm not 100% adamant against storing both. I'm just, I'd rather not for elegance reason and precisely for dry reasons. But I can be talked out of that one, if we have enough reason. Right now, I feel it is more elegant if we don't. But this is arguable.

45:51 - Michael Gartner (mclicks@gmail.com)
It's interesting. I think I was coming at it from the other way, because I thought you wanted to store native content. Yeah. Yeah. Yeah. For, I don't know, transactions that happen often or something. But I'm happy either way.

46:06 - Marc-Antoine Parent
For me, it was, I did say I wanted both. I don't remember so much what I said, frankly. But it makes sense that I may have wanted that because I wasn't fully trusting of the round-trip quality. And that remains true, by the way, but we'll see. But the thing is, if we can delay that choice, flip a switch, oh my god, and have test suites, that changes the whole dynamic. But otherwise, I'm in too dry. Yes, there's a computation cost. Meh. We'll live.

46:49 - Michael Gartner (mclicks@gmail.com)
And if it's an issue, we'll deal with it when it's an issue.

46:53 - Marc-Antoine Parent
Actually, the argument against storing native for Rome is that... Uh... It is nice to have the clean up text with the JSON totally on the side so we can apply an LLM to it.

47:11 - Michael Gartner (mclicks@gmail.com)
Sorry, say that again?

47:12 - Marc-Antoine Parent
It's nice to have the full separation of text and format that JSON gives us.

47:19 - Michael Gartner (mclicks@gmail.com)
Oh, yeah.

47:20 - Marc-Antoine Parent
So that we can apply an LLM to the clean up text.

47:26 - Michael Gartner (mclicks@gmail.com)
This is true.

47:27 - Marc-Antoine Parent
Which we would not get if we store Rome JSON.

47:35 - Michael Gartner (mclicks@gmail.com)
Yeah, it can get quite messy.

47:37 - Marc-Antoine Parent
Yep. So that's, I'm not saying it's a determining argument, but it's a weak argument for storing at JSON all the time. But as I said, we can punt that because it's not a need we have immediately.

47:55 - Michael Gartner (mclicks@gmail.com)
It's a good thing we went through this because we did this async and the whole thing, like a lot of this is just shot. don't doing. don't There needs to be changed if we are agreeing together on the...

48:03 - Marc-Antoine Parent
Yeah.

48:04 - Michael Gartner (mclicks@gmail.com)
Yeah. So quickly, functional requirements, content type we're adding, can't be null. Multiple representations of the same content like this already exists, so it's just reaffirming I agree that text plane is defined default.

48:19 - Marc-Antoine Parent
Okay, a multiple... Well, I'm saying probably we don't need it, but we can change our mind. Provisionally not. Sorry, is that the multiple representation, content uniqueness key, is that the one?

48:34 - Michael Gartner (mclicks@gmail.com)
No, we still just do need the values though, right? They don't have be part of the uniqueness key, but we do need content.

48:40 - Marc-Antoine Parent
Yeah, yeah, yeah, yeah, yeah, absolutely. And default text plane, yeah, I'm happy with that. Sounds good. Sounds good to me.

48:50 - Michael Gartner (mclicks@gmail.com)
Obsidian still happens the exact same way.

48:53 - Marc-Antoine Parent
Except now they'll go through the endpoint.

49:01 - Michael Gartner (mclicks@gmail.com)
And keep file references, they don't have to change, is that correct?

49:07 - Marc-Antoine Parent
Yep.

49:09 - Michael Gartner (mclicks@gmail.com)
Now these two change. Okay, how are we going to, I'm just going to highlight these. We've talked about it enough, I made initial, I'll probably just rewrite the whole thing. Okay, I'll give, I'll take 20 minutes, whatever it takes to double check that I'm happy with it. I'm pretty sure I will be. Then I'll rewrite these to include the changes that are reflected. Define shared content type constraints. Yeah, we want to store this, if possible, in a single content model package, maybe, if that works.

49:55 - Marc-Antoine Parent
And shared, oh yeah.

50:03 - Michael Gartner (mclicks@gmail.com)
So this rollout is different now, too, because if we're doing it through the endpoint rather than writing it twice, document the file, I can follow up. It still has to be documented and how it's going to happen, but it's more just written in code, mostly.

50:24 - Marc-Antoine Parent
know, I'm often harping about N versus N squared.

50:27 - Michael Gartner (mclicks@gmail.com)
Like, this is one of those great N versus N squared. Yeah, cool. Now, is, even if that's the only thing that came out of this, I think that's really fruitful. So that's good. Now, this is what I was talking about copying. I rewrote these. Let's see if copy and paste doesn't work. It happens, but I can't. Do this. I think Rome will take in this. Thank you. Okay. Kill that. These are old.

51:29 - Marc-Antoine Parent
So milestone zero is actually the endpoints, no up endpoints, and use them in the plugins.

52:04 - Michael Gartner (mclicks@gmail.com)
And what else do I to remove from here based on what we talked about?

52:12 - Marc-Antoine Parent
Oh, I would put the content, adding the content row before that, actually, because I don't want to change the endpoints to add the content.

52:22 - Michael Gartner (mclicks@gmail.com)
Sorry, say that again?

52:24 - Marc-Antoine Parent
I would add the content row before that because I don't want to change the endpoint to handle the content.

52:32 - Michael Gartner (mclicks@gmail.com)
Add the content row before mouse on one?

52:36 - Marc-Antoine Parent
Before, yeah, before the NOAA endpoint. That's, it's trivial, right?

52:39 - Michael Gartner (mclicks@gmail.com)
Adding a column. Mm-hmm. And so can we just include it in mouse on zero?

52:45 - Marc-Antoine Parent
Yeah. Yeah, sure.

53:21 - Michael Gartner (mclicks@gmail.com)
And then add JSON milestone 2. And all the tests will be in here.

53:26 - Marc-Antoine Parent
Yep. Well, now we can add the native storage intermediate solution as a milestone. Native storage plus add JSON translation as one of the milestones before add JSON storage.

53:48 - Michael Gartner (mclicks@gmail.com)
That's if, right? I think, did we say that's if the tests aren't fully?

53:54 - Marc-Antoine Parent
but well, yeah, it's before the tests already. For me, milestone 2 is with the tests. Milestone 1.5 or whatever in between would be make it all work with native storage, add JSON as a translator, but a shortcut when there's no translation needed, and that will be functional, useful to users before we have the tests ready and native storage and add JSON.

54:24 - Michael Gartner (mclicks@gmail.com)
So in my mind, I think what we're talking about there is just the NOAP endpoints, because they're going to keep doing what they're already doing. Do we actually really even need a translation?

54:38 - Marc-Antoine Parent
No, no, no, no, no. There's this stage where when I say native storage, I mean, in the case of Rome, Rome JSON versus Rome Obsidian, like the transition to Rome JSON, and then the endpoint has to do.

54:53 - Michael Gartner (mclicks@gmail.com)
And I think that's where we're diverging there. I don't think we should introduce Rome JSON if we don't have a JSON. But Fully fleshed out. I feel like that wouldn't really give us a lot of benefit versus the work it would take to them.

55:10 - Marc-Antoine Parent
I'm saying it's trivial work and there's no work in there that is not going to be useful long term. And it gives us the benefit that we can offer the functionality much earlier to end users.

55:29 - Michael Gartner (mclicks@gmail.com)
Offer what functionality?

55:32 - Marc-Antoine Parent
A higher quality, adjacent Roam to Roam round trip. Like if you're sharing Roam to Roam, you won't go through the degraded quality of Roam Markdown. And there's no work that is lost. There's no work that is wasted.

56:06 - Michael Gartner (mclicks@gmail.com)
So we're saying if we have rome.json to at.json, why aren't we just using rome.json to at.json then?

56:18 - Marc-Antoine Parent
Because we don't have the test suite yet.

56:22 - Michael Gartner (mclicks@gmail.com)
But if we don't have the test suite, how do we know if rome.json to at.json is any good?

56:28 - Marc-Antoine Parent
Precisely, we don't. So we don't trust it yet. So what we do is we store the rome.json in the database. It's good enough for rome to obsidian. This is the idea that we accept more loss between platforms. So if the rome.json to at.json is not good enough to give us perfect round trip rome to rome, but good enough to give us okay quality rome to obsidian.

56:56 - Michael Gartner (mclicks@gmail.com)
How do we know that it's okay quality to rome to obsidian?

57:00 - Marc-Antoine Parent
I'm assuming we have done basic sanity testing, like the idea is, I would like to introduce AdJSON in the data format when our test suite is really robust, but what I'm saying is it's an 80-20 thing, we'll have even a 60-40, let's say we have 60-40% of the tests, good enough, it looks good, okay, we can trust Roam2Obsidian with some loss in this, then it's time to introduce RoamJSON storage. And then the extra 40% that will take 80% of the time to know that we're really good enough to have round-trip quality Roam2Roam, even though we transit through AdJSON, then we can use AdJSON as a storage format, but that can be much later.

57:47 - Michael Gartner (mclicks@gmail.com)
I think my worry is introducing an additional step here that we may or may not know if we're using or how we're using it. So, my mental model is, we currently have... We're just going to accept the lossiness of markdown. We're going to do obsidian markdown, Rome markdown. Great. And until we get that 80-20 or 60-40, whatever we're saying for our JSON, then we switch. But there's no intermediate step of Rome JSON to obsidian markdown because that's a whole other pipeline we'd have to create that. We'd have to test to make sure it's good. We'd have to do the whole thing, but we're already going to be doing that for our JSON. So let's just do that for atJSON and not like this middle thing.

58:32 - Marc-Antoine Parent
What I'm saying is, A, yes, I agree. It's the same work. We're doing that anyway. We'll do it. We'll do Rome JSON to add JSON to markdown. Yes. But we'll do it in the translation step, and that means it's only lossy for the Rome to JSON translation. Whereas in the Rome to Rome, we'll have stored Rome JSON. That means the Rome to Rome can be . It's higher quality, even if we don't trust that JSON-ROM roundtripping. Even if the ROM at JSON is not at roundtripping level, which is a higher mark than good enough for interplatform translation, roundtripping is a very high mark. So that one is the one I'd delay. But if we store ROM native, we'll do the exact same work, ROM native to add JSON to markdown, which we need to do anyway, except we'll do it at the translation step. Instead, at the storage step. And it's, again, good enough for the inter... We've augmented the quality of the ROM to ROM sharing without compromising the ROM to Obsidian sharing.

59:51 - Michael Gartner (mclicks@gmail.com)
I think that's the assumption that I don't know if holds true, because right now we can use ROM functions. to get markdown from Realm.json. If we store Realm.json, we don't have access to that function anymore. We'd have to write it ourselves. And there, that's when we're assuming that we're going to get this 80-20. It's going to be Fidel. It's going to have some lossiness, but it's going to be good enough. We'd have to just write it. So we don't know that. We'd be writing a whole other test to make sure we're translating this blob.

1:00:26 - Marc-Antoine Parent
No, no. Once again, this is not a new function. This is the same function that we'll use anyway later to translate Realm.json to add.json to markdown.

1:00:37 - Michael Gartner (mclicks@gmail.com)
What about Realm.json to obsidian markdown?

1:00:41 - Marc-Antoine Parent
To obsidian markdown. That's what I meant, to obsidian markdown.

1:00:43 - Michael Gartner (mclicks@gmail.com)
How do we do that? How do we go Realm.json? So we have Realm.json in our database, and now an Obsidian consumer is like, give me this. How do we take this Realm.json to make it to obsidian markdown?

1:00:56 - Marc-Antoine Parent
How do we do that? We do the exact same thing. We do Realm.json to We do exactly what we planned to do anyway. We're not doing anything different. We're not writing a different function, except the test suite is smaller because the requirements are smaller. The test suite is halfway built instead of fully built. It's halfway built to the point that it's at least as good as the Rome markdown to Obsidian markdown path. But even though we don't trust it enough to give us full round trip to Rome to Rome, because that's later in the test suite building, we can use Rome storage to keep AppJSON out of the Rome to Rome path for a while longer while we keep building the test suite. Test suite is halfway built. We know it's good enough that we know that... The RomeJSON to AdJSON to Obsidian Markdown path is good enough, but we have a high-quality Rome2Rome now because it doesn't transit to AdJSON. And it's no extra work. It's no extra work. If it's extra work, that falls, but it's no extra work.

1:02:28 - Michael Gartner (mclicks@gmail.com)
I'm skeptical that it's no extra work because we're creating a special case that we're trying to handle.

1:02:34 - Marc-Antoine Parent
It's not a special case. It's not a special case that much because the generic thing I'm saying is, first, we'll have the no-op operators that will go store whatever you receive. That's not moving until later. And eventually, it will be, take whatever you receive, store it as AdJSON, but that's later. Thank Thank Here So that doesn't move. And the reader, we read whatever you receive and translate it to whatever you're asked through at JSON. If there's any translation step, goes through at JSON, and that has not changed.

1:03:21 - Michael Gartner (mclicks@gmail.com)
Yeah. In my mind, if we have an at JSON step, we then can probably at the point where we can store at JSON.

1:03:28 - Marc-Antoine Parent
And what I'm saying is not necessarily. What I'm saying is the quality requirements for inter-platform are not the same as same platform sharing. Yeah.

1:03:39 - Michael Gartner (mclicks@gmail.com)
you know what? That actually brings up a really good point, because I think I was assuming that we were storing the native format so that we could have platform-to-platform fidelity at 100%. Whereas if we don't store that at all, that's a pretty high bar, I think, as you mentioned. Exactly.

1:03:58 - Marc-Antoine Parent
Which we can put later.

1:04:00 - Michael Gartner (mclicks@gmail.com)
I don't know. I'm just wondering if that's a bar that we should even try to achieve. If I'm sharing between Rome and Rome.

1:04:08 - Marc-Antoine Parent
That's a valid question. And this is what I'm saying. Let's assume we are doing native storage for now. Because that path works. And then as we build the test suite, we're like, okay, how much work do we feel there's left on the test suite to get adjacent storage? And full fidelity, or maybe we'll decide this is not going to happen. We'll want to store both. It's okay. We can decide that later. What I'm saying is native storage is a immediately useful step either way, intermediate step. And the next step may be store both or decide that we can get away with just storing at JSON, but we can fund that this But I think the intermediate store native is going to be useful in all cases as an intermediate step that adds value now. I am open to either storing both or perfect that JSON roundtrip as two possible, and we'll see. But we'll have something useful before we need to take that decision by storing natively.

1:05:25 - Michael Gartner (mclicks@gmail.com)
I'll have to make those markers clear. I think I understand what you're saying, and I'm generally okay with it. I think I'm not okay with the fact that there's the arbitrariness in it. So if we remove that arbitrariness and say, okay, when we have X, whatever, 60% test passing, then we transfer over. But at that point, the next question that I think we're going to get to is like, well, what does it take to get 100%? 100% to 100% fidelity. I think that's near impossible. Like, it's a moving target, right? Because of the fact that it can change.

1:06:07 - Marc-Antoine Parent
Correct.

1:06:10 - Michael Gartner (mclicks@gmail.com)
Why don't we even try and fight that battle? Well, why don't we just say, give me your format, it's here, and then we can use it directly for the cases that are Roam to Roam.

1:06:20 - Marc-Antoine Parent
I agree that it's a moving target, but I'll make a counter argument to that.

1:06:25 - Michael Gartner (mclicks@gmail.com)
Okay.

1:06:29 - Marc-Antoine Parent
When Roam format changes and we haven't caught up yet, what will often happen is that we'll have old style stuff in the database native, whether it's alongside or the only thing, doesn't matter. And then we'll give it to a newer Roam and Roam will probably cope with the discrepancies. Rarely the reverse. And if we haven't caught up and we round trip the old Format perfectly, it's exactly the same situation, or near enough perfectly, exactly the same situation. It's like we've stored maybe even the old format in our old translators, so the adjacent's a bit dated, we'll spit out older Rome, and then Rome will have to cope with older Rome, which presumably it can. The one problem is if there's a lot of really important information in the new Rome that we don't know how to read yet, and that we store, yeah, sure, that's the case.

1:07:41 - Michael Gartner (mclicks@gmail.com)
And storing another, I'm pretty sure we're going to have to store native debugging. We need it for debugging. If we're taking a native format and translating it, and that's our sole source of truth, and it's like, hey, broke. We'll like, what? It looks great. It looks fine. We have no way to know, like, what it broke from. I'm pretty sure we have to store native.

1:08:03 - Marc-Antoine Parent
Could be. Okay, so executive decision, which I propose. Let's modify the unique key so we can do both, and we have a choice. I'm proposing we punt that decision. I'm really proposing we punt that decision. We can start with storing native only in all cases, because that's a functional path. And then we can decide, what are the latencies? Do we need, like, what are the benefits of storing only at JSON? The way you describe them to me, they're mostly subjective. You know, oh, it's only one thing that I can control. Yeah, I agree. I buy it, but it's mostly subjective. What is the true value of that? It's a real question. All right. As to using add.json as a translation layer for A to B.

1:09:07 - Michael Gartner (mclicks@gmail.com)
Storing native, the benefits are moving target, and so storing native here. Benefits of storing native when moving from native to native moving target will always be one. And that's not true if we're storing native, and the other one is debugging. If we store at json and at json conversion, and it goes wrong, we don't know why, how to inspect.

1:09:59 - Marc-Antoine Parent
So yeah. Maybe storing at JSON is not worth it.

1:10:05 - Michael Gartner (mclicks@gmail.com)
Interesting.

1:10:07 - Marc-Antoine Parent
No, seriously.

1:10:08 - Michael Gartner (mclicks@gmail.com)
I the benefit of storing at JSON, because then it would be a shorter conversion, because we're going one to N rather than whatever translate to JSON and then translate.

1:10:21 - Marc-Antoine Parent
But is it worth it? Because, I mean, yeah, it may be worth it. I don't know. I don't know. On the other hand, it means we're translating all the time. Well, if we're storing both, it's smooth, yes. If we're storing native and at JSON, okay, then there's a storage cost. If we're storing... It's always the same, right? Storage versus time. Compute. So storing both has a storage cost, but no other great cost. Storing at JSON, only moving target, high requirement of quality.

1:11:25 - Michael Gartner (mclicks@gmail.com)
Storing native is the moving target.

1:11:33 - Marc-Antoine Parent
Ah, in some ways. In some ways, it's easier because at least the round trip doesn't require, like, if the target moves and we're storing native, newest, what do we care? The platform stores native, receives native. If it's changed, we don't need to know.

1:11:58 - Michael Gartner (mclicks@gmail.com)
Yeah, for the native platform.

1:12:00 - Marc-Antoine Parent
Yeah.

1:12:01 - Michael Gartner (mclicks@gmail.com)
But if you're going anywhere else.

1:12:03 - Marc-Antoine Parent
If you're doing interplatform, what I'm saying is it's a moving target, but what I'm saying is there's probably enough core that will be stable that the translation, we can trust the translation to. Yeah, it won't take the latest, but will it really lose stuff? Maybe, but rarely, I think. I think most of the time it won't be a big cost, but yeah. But I mean, I don't think, okay, let me put it this way. Yes, it's a moving target, but it's not more or less of a moving target than at JSON. Because either you need to, you lose it in the, like basically either way, you're storing a moving, you're translating a moving target to another moving target. Whether the steps throughout JSON happens at.

1:13:03 - Michael Gartner (mclicks@gmail.com)
I'd be more comfortable being confident on import time that I know what I'm getting and that I'm getting and it's not going to break. Whereas if we're doing it at translation time, we don't know that we're going to, we're going to try and translate. it's like, oh, this doesn't work anymore.

1:13:35 - Marc-Antoine Parent
Yeah, interesting. This is something which we could do sanity testing at ingestion or some sanity testing at ingestion, meaning if the format changed in a way that it's not readable anymore, we could know about it at absurd time instead of read time. And then not clobber old data. Was that helpful? But the reality is, if it's changed so that we can't translate it, it's also changed so that we can't store it. So I don't see the difference.

1:14:14 - Michael Gartner (mclicks@gmail.com)
Sorry, what are your negatives for storing both? It's storage, right? That was it?

1:14:17 - Marc-Antoine Parent
Yeah, that was it.

1:14:19 - Michael Gartner (mclicks@gmail.com)
Yeah. So I think we eat that cost until it becomes an issue. So I don't think it's going to be an issue at our scale for a very, very long time. And the upside is huge. Debugging and knowing what went wrong, when it went wrong, especially at this early stage, is invaluable data.

1:14:34 - Marc-Antoine Parent
As I said, I am not strongly opposed to storing both. I was just trying to evaluate cost benefits. But I do think that you overrate the benefit of storing at JSON. I may be wrong, but you haven't convinced me that it buys us anything. The breakage scenarios you envisage, for me, they exist either way. I don't see a single breakage scenario at Translate that doesn't happen elsewhere in the pipeline if we store the add.json, or very few and very few that matter.

1:15:11 - Michael Gartner (mclicks@gmail.com)
So, like, the one example is if you've already stored, let's say we have 10,000 nodes in add.json stored, and we have the translation from add.json to pre-existing Rome, let's say Rome changed. We have add.json to Rome version 1, and it's now version 2, whatever, version 1.1, and we can also go from add.json to Obsidian. No breakage. We know that's going to happen. It's always going to happen, and it's not going to break. And now Rome changes. We can still, those 10,000 nodes are good. They're all going to work. They're always going to work. But if we were storing native.json, Rome.json, and they change something, it's unlikely, you're right, probably not going to happen. But it could happen where they break our whole... And we can no longer get out proper Obsidian Markdown. And so those 10,000 nodes just break. Like that's possible. It's not possible in the first scenario. It is possible in the second scenario.

1:16:14 - Marc-Antoine Parent
Yes and no, because what I'm saying is if they break, it's because the translation from ROM 1.1 to add JSON is broken, presumably. So that means either we cannot detect it at the point of conversion, and then they will break on a few further sync or update or whatever. And I expect the time will change, so they will be synced back. So the breakage will happen anyway. Or we can check it at the moment of ingestion, which is in some cases is possible. And then we can, but that's good. That means we can check it at the moment of ingestion and do the guarantee. Like when we upload native, what we could do, which I think would be So it, is do a sanity check. Can I get this new native format to add JSON? Not to add JSON to markdown, but just to add JSON. And if that breaks, detect it and say, hey, you know what, I refuse to ingest this, even though I'm going to store it native. It's more compute. It's more compute. It's more compute. But it does mean, but we're gaining on start.

1:17:27 - Michael Gartner (mclicks@gmail.com)
But are we really?

1:17:28 - Marc-Antoine Parent
Is it worth it? Is it worth it? Maybe not. But you see what I'm saying? I'm not convinced that we've saved a real case of breakage, is what I'm saying. I think in most cases, we won't detect it even if we do that pre-work. And that means it will be lost at the moment of sync. And I think that if they do a big change like that, it's likely that the last modified will move and then we'll just sync everything and lose everything anyway.

1:18:02 - Michael Gartner (mclicks@gmail.com)
Oh, yeah. No, I don't think so. It could be, because it's not content that's changing. That's what we're looking at. We're looking at when did the content change?

1:18:13 - Marc-Antoine Parent
Yeah, you may be right there. But what I'm saying is, slowly things will be synced up and become inoperant. Maybe it's slowly sort of at once, but either way, that data will become hard to sync.

1:18:35 - Michael Gartner (mclicks@gmail.com)
Like, if they break it, it won't sync for us because it's broken. But if we're syncing it without checking, we have to add a check. You're right. We'd have to do more work to add a check to make sure that it's not breaking. And we have to make sure we're checking it correctly. Whereas that's also moving target. It's like, well, what does it correctly mean?

1:18:55 - Marc-Antoine Parent
No, no, no. I think here we'll have to be content with AT20. But I think in all cases, what is clear is the adjacent breakage, and it's also true that if they change things, the new values will be uploaded progressively, and that means it won't be everything breaks at once, it will be things break as they're synced. So either way, things will break as they're synced, whether it's because, let's say we don't detect it either way, right? So either we stop noticing, we write bad at JSON at the moment of sync. That wouldn't happen. Why?

1:19:51 - Michael Gartner (mclicks@gmail.com)
We write at JSON that works or doesn't, right? How would you write bad at JSON? Like, if we're storing at JSON, we either take the...

1:20:03 - Marc-Antoine Parent
What I meant by bad-adjson is the wrong format has changed enough so that our translation to adjson is very lossy.

1:20:11 - Michael Gartner (mclicks@gmail.com)
It breaks. It wouldn't be lossy, would break.

1:20:14 - Marc-Antoine Parent
No, it could be lossy. How could it be lossy and not break? We have deterministic rules, right?

1:20:26 - Michael Gartner (mclicks@gmail.com)
This is the input we're getting, this is how we're storing it. I don't understand how something could be lossy.

1:20:31 - Marc-Antoine Parent
The format is such that the text is now in another field, so we don't see it. So we just, oh, there's all this structure. Oh, funny how little text there is, but we don't notice it. So we just write this empty string because the data is actually elsewhere in the structure, but there's no, or maybe there's no, nothing in our code that notices that the things have moved. It's just, oh, there's very little bit we expected, but maybe it was a very short text, and then we send that. We create an adjacent structure, which is mostly empty, because we don't notice that things have moved. They've moved. That's a lossy, non-breaking scenario. It happens. That's what I think is the most likely consequence of moving target, or the most likely is actually they've added new fields, which we don't capture and we don't care. That's the most likely consequence. But the dangerous likely consequence is that one. And then whether it happens at the moment of storage, before or after storage, is perfectly irrelevant.

1:21:52 - Michael Gartner (mclicks@gmail.com)
Yeah. In the scenarios I'm imagining, I think it's not perfectly irrelevant. Just the fact that we have All the data that we know we can still use, it still will work until it's overwritten. It is less likely to be silently overwritten than to not be overwritten when it breaks, versus if we're just storing it without any checks, it'll be overwritten before it breaks and then we can't use it. Which would then entail creating some type of security measure on top of which that may or may not conform to the format in which we want to store it in but doesn't, so then it's kind of like this weird in-between state, whereas if we know we're storing this is the content we're storing, this is what we can test against, this is what we know we want, then it's no longer a moving target, it is very concrete of like, this is the data.

1:22:52 - Marc-Antoine Parent
I think we're not converging on this, but it doesn't matter. We are converging on, we'll start with storing both. And I'm okay with that. I don't have big problems. I mean, not with start, but we'll store both for a while. And we'll live with that for a while. And then we'll see if we can get away with one of them. But I think we're converging on, we'll always keep native. Will we always keep adjacent as the one point of divergence? But I think it can be punted because there's a lot of things, there's a lot of hypothetical scenarios we need to think both things through. But none of this is blocking us from doing a lot and moving forward.

1:23:36 - Michael Gartner (mclicks@gmail.com)
Fair enough. Okay. Let me quickly go through these. And then I have a whole other document, depending on how much time you have.

1:23:46 - Marc-Antoine Parent
Energy is flagging.

1:23:48 - Michael Gartner (mclicks@gmail.com)
Yeah. So let me know. You can just keep me up to date. There's just some listed open questions. Most of them already have leanings. So where should we store shared content types in some type of content? That's what utel is for. Exactly. Or like some special package content thing. I'm not exactly sure where it's going to look, but somewhere shared would be nice.

1:24:14 - Marc-Antoine Parent
A lot of this actually can live, only a few constants will live in utel. Most of the code will live in website.

1:24:26 - Michael Gartner (mclicks@gmail.com)
This might change since our recent discussions, how much of the obsidian Rome parser work is required for v0, old enough to source to canonical conversions. Right, add.json rows, but this is only when we actually get to add.json fully. So we've decided to, on storing both, store native and sear.

1:24:55 - Marc-Antoine Parent
I still think there'll be a milestone where we just store native and another one where we store both. But we'll see.

1:25:04 - Michael Gartner (mclicks@gmail.com)
Yeah, it'll be interesting to see what it looks like as we get through it.

1:25:07 - Marc-Antoine Parent
We don't need to decide that now. That's the beauty of the current situation.

1:25:14 - Michael Gartner (mclicks@gmail.com)
Should native exports become storable, durable representations? That's what we're discussing. And so deferred, but...

1:25:24 - Marc-Antoine Parent
Leaning towards yes.

1:25:25 - Michael Gartner (mclicks@gmail.com)
I'm leaning towards yes. Strongly.

1:25:27 - Marc-Antoine Parent
We're both leaning strongly towards yes.

1:25:33 - Michael Gartner (mclicks@gmail.com)
Long-term source of embeddings is the derived text. I'm not sure how the actual database looks like for this, so I have to double-check. Like, is there an issue or not on how it currently works? Because like I said, haven't looked deeply into it. So let's say we did sort at JSON. Do we need a whole other separate just text content field so that embeddings can use that? Or do they derive it... As they're going to embed it, or like...

1:26:02 - Marc-Antoine Parent
Okay, the embedding right now is done client-side, which I hate. And that is something we'll be able to change with an absurd endpoint, by the way. I'm just realizing we can get it done by Next.js, which delights me to no end. Client shouldn't have to worry about that.

1:26:32 - Michael Gartner (mclicks@gmail.com)
I'm slightly worried about the cost. don't know, but I'm just... I would keep my eye out for how much cost that's going to cost. Like, how long will these lambdas be open, and is that going to cost us? That's all.

1:26:46 - Marc-Antoine Parent
We're actually... we're not going to calculate more of them, and we're going to... we won't have to... there'll be less leakage. I think less possibility of leakage. I may be wrong, but I think there's less possibility of leaking the embedding order key. I think this will actually be a gain. I have spoken elsewhere. Superbase has its own embedding structure, and I do like that scenario because it will be faster, basically. It's more performance issue. Anyway, so those are all other considerations, but I do like the idea that in the we can say we can not do the embeddings, it will make the sync so much faster because we'll be able to send stuff and not wait for the embeddings to send the sync. We'll wait longer for the response, of course, because. It will be done at the Next.js level, but anyway, that's all another store. The consequence on embedding, right now embeddings are tied to the exact content variant. If we store both, we'll want to store it only on one, probably only on the native, but it doesn't matter much because it's looking at the text field. Right now the text field is marked down, the text field will become pure text, which is a bit of a loss. We could, and that's totally a choice, decide that we'll tell the endpoint to convert the text to markdown before sending it to the LLM. For example, right now we're just have markdown and that's what we're operating on, client side. It would also be, I think, a wonderful opportunity. to clean up the format. Like, I'm sure that we'd get better results if we moved the claim evidence, prefix, and the source suffix, and blah, blah, blah, and just had the raw thing, which is totally another story, but a proposal while I'm at it.

1:29:16 - Michael Gartner (mclicks@gmail.com)
I thought Sid was already doing some of that stuff because he already has additional embedding content. Like, it's not always title for certain nodes you can choose, whether it's title and a block. So it'd be weird if he included the claim in front of it, if he's already doing that other work too.

1:29:37 - Marc-Antoine Parent
My memory is that the title is sent raw, but I could be wrong.

1:29:42 - Michael Gartner (mclicks@gmail.com)
Yeah, seems, yeah, counterintuitive to me, but yeah.

1:29:50 - Marc-Antoine Parent
We're checking. I didn't check that. So, but my memory is that it's certainly what we're doing in Obsidian. It's the raw thing. What else? Yeah, no, the embeddings, I don't foresee a problem. Having add.json will be in some ways beneficial in that we could just apply it to the text. And if it's, for example, an add.json thing, sorry, a Rome.json thing, we'll store it as add.json and we'll apply the embedding to the add.json, it's easier. But we could convert it to markdown in the translator function, in the ingestion function.

1:30:35 - Michael Gartner (mclicks@gmail.com)
That's probably makes sense, yeah.

1:30:38 - Marc-Antoine Parent
Yep.

1:30:40 - Michael Gartner (mclicks@gmail.com)
Okay, quickly, some risks. Obsidian import breaks. I don't think it's really that big of a deal that we've kind of figured out. At.json overwrites markdown rows. This has changed based on how we're talking about things because it will eventually overwrite the markdown rows. So not a big deal.

1:30:56 - Marc-Antoine Parent
we will add the content to the unique. I think we agreed to that.

1:31:02 - Michael Gartner (mclicks@gmail.com)
Serialize.json enters search. I don't think we'll... It is a risk, but we'll have to just make sure we're not doing that, just as you were talking about, where it could be handled. You mentioned reference. Fob references are not actually an issue here. They're all...

1:31:17 - Marc-Antoine Parent
Nope.

1:31:18 - Michael Gartner (mclicks@gmail.com)
Good. Overfitting the same page model. Definitely an issue. Potential. So I'll be wary of that while converting it over. Readers switch to...

1:31:31 - Marc-Antoine Parent
What is that? is that?

1:31:33 - Michael Gartner (mclicks@gmail.com)
I didn't get it. Like we're using what same page is already doing to inform our discourse graph document structure. But we don't want to overfit whatever they were doing. Saying, oh, they're doing this. That means whatever same page was doing for their at.json.

1:31:48 - Marc-Antoine Parent
What is same page? Sorry, I don't know same page and I don't know its assumptions.

1:31:51 - Michael Gartner (mclicks@gmail.com)
Right. Same page was what Vargas was working on after discourse graphs in terms of... of syncing between Roam, Obsidian, Notion, et cetera, and he was using add.json as that content model. So we have a rich existing structure there that we could look at, but we shouldn't just copy it over one for one.

1:32:16 - Marc-Antoine Parent
Yep.

1:32:20 - Michael Gartner (mclicks@gmail.com)
And readers switch to add.json before parity.

1:32:23 - Marc-Antoine Parent
We don't care. Well, I mean, we'll still have to do the transition to always using the endpoints.

1:32:31 - Michael Gartner (mclicks@gmail.com)
Yeah, the endpoints make this a lot easier for sure. Yes. Okay. So generally speaking, do you think goal is clear?

1:32:40 - Marc-Antoine Parent
Yeah.

1:32:41 - Michael Gartner (mclicks@gmail.com)
Scope is clear?

1:32:42 - Marc-Antoine Parent
Yeah.

1:32:43 - Michael Gartner (mclicks@gmail.com)
Autoscope is explicit?

1:32:45 - Marc-Antoine Parent
Yep.

1:32:46 - Michael Gartner (mclicks@gmail.com)
Use cases?

1:32:48 - Marc-Antoine Parent
There's still things to be decided, right? But they can be prompted.

1:32:52 - Michael Gartner (mclicks@gmail.com)
But in terms of like a V0 getting started?

1:32:55 - Marc-Antoine Parent
Yeah. Oh, yeah, yeah. We can proceed. There's nothing blocking us from start.

1:32:59 - Michael Gartner (mclicks@gmail.com)
Yep. Okay, cool. Yeah, I think that was very helpful and useful. I'll show you this next document unless there's anything else you want to say.

1:33:10 - Marc-Antoine Parent
No, nothing. I think we're fine. That was great use of common time.

1:33:17 - Michael Gartner (mclicks@gmail.com)
I agree. This one is going back to the internal data layer, and I'm just trying to get a handle. This is more like, as an engineer, how can I get a handle on kind of what's going on from the schema to the data layer and where do things point to? And this is a stab in that right direction. So there's no code here. This is just information. You could read this async as well. We don't have to go through it together. This is the document that I'm talking about going through, and it's just walking through, again, what are some of the sources of truth? How do we go from schema to database? If we need to point to things like concepts and content, what does that look like? And so there's a mapping between.

1:34:00 - Marc-Antoine Parent
Yeah, clarify, because it's a mess.

1:34:04 - Michael Gartner (mclicks@gmail.com)
Okay, fair enough. That's all this really is, and I'm more than happy to get any input you have on this. Hey, we should change this, or maybe not change this section, but this is a potential task for future massaging, whatever.

1:34:20 - Marc-Antoine Parent
Okay. Just generally, A, I agree it's important, it needs to be done. I'll do a bit of it for Mira, and I'm totally overloaded before Mira now, because we discussed with Luke, spoke about a few things to do, and it's like, ah! So I will...

1:34:42 - Michael Gartner (mclicks@gmail.com)
Yeah, understandable.

1:34:43 - Marc-Antoine Parent
No rush on this one. I'll ask to punt this. But there will be Mira stuff that will be relevant to this, that will have a more firm basis to pursue this after Mira.

1:34:57 - Michael Gartner (mclicks@gmail.com)
That sounds good. Yeah, if things come up... In your mind, while you're working on them on Mira, just shoot me a message saying, hey, this relates to this. And then I can kind of catalog it and go through it. And if you have time or want to, feel free to do this async. But I totally understand that that probably is out of scope based on what you're working on. Totally makes sense.

1:35:19 - Marc-Antoine Parent
The, I don't know if you remember, I had done, and I'm trying to remember where it is, I had taken the, what's it called? The LinkML, you know, I started with LinkML, and I had it generate documentation for what it's worth. It's not that good, but it's not nothing either. And I had pointed you to it, and now I have to remember where it is, and it won't be long, papers revealed temp, the DG, oh, DG schema, oh, my God, it's not obvious. Okay, so this would be the path. One second, we'll zoom, chat. So this is a description of the, you see it? This is a description of the database. At the time I started, it's out of date, but I could easily make that up to date, and I think it's worth it. And that would be database schema documentation. And then each of them, you see, get plant UML and, you know, basic explanations and stuff. So I could maintain that and add to that. I think that would be up.

1:36:49 - Michael Gartner (mclicks@gmail.com)
More for me, it's going from the turtle schema to this, because there's discrepancies.

1:36:56 - Marc-Antoine Parent
Yes, It's not there. There's tons of discrepancies. Because the turtle schema is a sharing schema, as opposed to an internal schema. And making those explicit is a thing. And I don't know, like, this is for describing turtle in a way, and maybe I should make a different one for the turtle. But I don't think I have tooling that allows me to show how they are related. And that's something I need to think about. But I could have also a version of this, which is more, here's the turtle schema, as in this representation, which would also be useful.

1:37:41 - Michael Gartner (mclicks@gmail.com)
Yeah, it's more like, because we have the separation of, like, relations and nodes going down to that, of like, what does that look like in the database as a concept? Or, I mean, because concept is kind of all of them. It's the schema, the relation and node, and the instances. And so understanding that difference.

1:38:00 - Marc-Antoine Parent
Some of that is explained in the docs. I agree and understand.

1:38:10 - Michael Gartner (mclicks@gmail.com)
And I remember seeing there's a readme and it kind of shows a little bit of that. But I think it's more so like the jumping off point of I'm looking at this schema. Now, how do I see the database in relation to this schema rather than...

1:38:24 - Marc-Antoine Parent
it. Got it. And it's a perfectly fair ask. It's a perfectly fair ask and I will. One thing that will happen by tomorrow is I'll take the JSON-LD code. No, probably by Sunday. I'll take the JSON-LD code I've written for Luke and I'll put it in the mainframe. I'll take out the relational text and put it in the main branch. So we'll see what I do to do these equivalents.

1:38:55 - Michael Gartner (mclicks@gmail.com)
I understand this can be punted till after, but that's kind of where this was. Yeah, yeah.

1:39:01 - Marc-Antoine Parent
No, clearly after.

1:39:02 - Michael Gartner (mclicks@gmail.com)
Please, please, please. I'm going crazy here. When are you going? When's the date?

1:39:09 - Marc-Antoine Parent
The 6th.

1:39:10 - Michael Gartner (mclicks@gmail.com)
6th.

1:39:12 - Marc-Antoine Parent
Basically in a week.

1:39:14 - Michael Gartner (mclicks@gmail.com)
Yeah, 6th until...

1:39:15 - Marc-Antoine Parent
20th.

1:39:17 - Michael Gartner (mclicks@gmail.com)
20th. Super exciting.

1:39:22 - Marc-Antoine Parent
Yes. Yes, yes, yes. Cool. No, no. And perfectly valid ask, the other thing, it needs to be made clearer because right now it only lives in my head and that is not healthy. It's not a huge rush.

1:39:42 - Michael Gartner (mclicks@gmail.com)
It's just one of those things. One of the many things we got to get to.

1:39:46 - Marc-Antoine Parent
Yeah, yeah, yeah, yeah. Legit, legit, legit. And what I should do, which shouldn't take that much time, is update the documentation to the database. It'll be clearer. That's totally worth doing.

1:40:00 - Michael Gartner (mclicks@gmail.com)
Yeah, yeah. No, clearly after.

1:40:02 - Marc-Antoine Parent
Please, please, please.

1:40:04 - Michael Gartner (mclicks@gmail.com)
I'm going crazy here. When are you going? When's the date? The 6th.

1:40:10 - Marc-Antoine Parent
6th. Basically in a week. Yeah, 6th until...

1:40:15 - Michael Gartner (mclicks@gmail.com)
20th. 20th. Super exciting. Yes. Yes, yes, yes. Cool. No, no. And perfectly valid ask, the other thing, it needs to be made clearer because right now it only lives in my head and that is not healthy. It's not a huge rush. It's just one of those things. One of the many things we got to get to. Yeah, yeah, yeah, yeah. Legit, legit, legit. And what I should do, which shouldn't take that much time, is update the documentation to the database. It'll be clearer. That's totally worth doing. Cool. Okay, then. Have a good weekend, and we'll see you before you leave, I guess, right? Yeah. Yeah. Yeah. week. Okay. So next week. I have, I still have a week. Yes. Cool. We'll see you then. That's out. See you then. Bye.
